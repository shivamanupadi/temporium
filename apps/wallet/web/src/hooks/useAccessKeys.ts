import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWalletClient, useAccount } from 'wagmi';
import { tempoPublicClient, Actions } from '@/lib/tempo-client';
import { DEFAULT_FEE_TOKEN_ADDRESS, ACCOUNT_KEYCHAIN_ADDRESS } from '@/lib/constants';
import { getSignatureTypeNumber } from '@/lib/access-keys-utils';
import { apiGet, apiPost } from '@/lib/api-client';
import { Abis } from 'viem/tempo';
import type { Address } from 'viem';
import type { AccessKey, AccessKeyType } from '@/types';

export const ACCESS_KEYS_QUERY_KEY = 'accessKeys';

export interface AccessKeyWithMetadata extends AccessKey {
  dbId?: string;
  label?: string;
  createdAt?: string;
}

interface DbAccessKey {
  id: string;
  owner: string;
  keyId: string;
  signatureType: string;
  txHash: string | null;
  label: string | null;
  createdAt: string | null;
}

interface UseAccessKeysReturn {
  keys: AccessKeyWithMetadata[];
  isLoading: boolean;

  authorizeKey: (params: {
    keyId: Address;
    keyType: AccessKeyType;
    expiry: number;
    enforceLimits: boolean;
    limits: { token: Address; amount: bigint }[];
    feeToken?: Address;
  }) => Promise<{ transactionHash: `0x${string}` }>;

  revokeKey: (params: {
    keyId: Address;
    feeToken?: Address;
  }) => Promise<{ transactionHash: `0x${string}` }>;

  updateSpendingLimit: (params: {
    keyId: Address;
    token: Address;
    newLimit: bigint;
    feeToken?: Address;
  }) => Promise<{ transactionHash: `0x${string}` }>;

  getKey: (keyId: Address) => Promise<AccessKey | null>;
  getRemainingLimit: (
    keyId: Address,
    token: Address
  ) => Promise<{ remaining: bigint; periodEnd: bigint } | null>;

  refresh: () => Promise<void>;
}

export function useAccessKeys(): UseAccessKeysReturn {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const queryClient = useQueryClient();

  const { data: keys = [], isLoading } = useQuery({
    queryKey: [ACCESS_KEYS_QUERY_KEY, address],
    queryFn: async (): Promise<AccessKeyWithMetadata[]> => {
      if (!address) return [];

      try {
        const dbKeys = await apiGet<DbAccessKey[]>('/v1/access-keys');

        const hydratedKeys = await Promise.all(
          dbKeys.map(async dbKey => {
            const keyId = dbKey.keyId as Address;

            try {
              const keyData = await Actions.accessKey.getMetadata(tempoPublicClient, {
                account: address,
                accessKey: keyId,
              });

              return {
                keyId,
                signatureType: keyData.keyType as AccessKeyType,
                expiry: Number(keyData.expiry),
                enforceLimits: keyData.spendPolicy === 'limited',
                isRevoked: keyData.isRevoked,
                dbId: dbKey.id,
                label: dbKey.label ?? undefined,
                createdAt: dbKey.createdAt ?? undefined,
              };
            } catch (error) {
              console.error(`Failed to fetch on-chain state for key ${keyId}:`, error);
              return null;
            }
          })
        );

        const validKeys = hydratedKeys.filter(
          (key): key is NonNullable<typeof key> => key !== null
        ) as AccessKeyWithMetadata[];

        const uniqueKeys = new Map<string, AccessKeyWithMetadata>();
        for (const key of validKeys) {
          uniqueKeys.set(key.keyId.toLowerCase(), key);
        }

        return Array.from(uniqueKeys.values()).reverse();
      } catch (error) {
        console.error('Failed to fetch access keys:', error);
        return [];
      }
    },
    enabled: !!address,
    staleTime: 10000,
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: [ACCESS_KEYS_QUERY_KEY, address] });
  }, [queryClient, address]);

  const authorizeKey = useCallback(
    async (params: {
      keyId: Address;
      keyType: AccessKeyType;
      expiry: number;
      enforceLimits: boolean;
      limits: { token: Address; amount: bigint }[];
      feeToken?: Address;
    }) => {
      if (!walletClient || !address) throw new Error('Wallet not connected');

      // authorize requires off-chain key authorization signing which needs
      // a LocalAccount. wagmi provides JsonRpcAccount, so we use writeContract directly.
      const hash = await walletClient.writeContract({
        address: ACCOUNT_KEYCHAIN_ADDRESS,
        abi: Abis.accountKeychain,
        functionName: 'authorizeKey',
        args: [
          params.keyId,
          getSignatureTypeNumber(params.keyType),
          BigInt(params.expiry),
          params.enforceLimits,
          params.enforceLimits
            ? params.limits.map(l => ({ token: l.token, amount: l.amount }))
            : [],
        ],
        feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
      } as any);

      await tempoPublicClient.waitForTransactionReceipt({ hash });

      try {
        await apiPost('/v1/access-keys', {
          keyId: params.keyId,
          signatureType: params.keyType,
          txHash: hash,
        });
      } catch (error) {
        console.error('Failed to save access key to DB:', error);
      }

      await refresh();

      return { transactionHash: hash };
    },
    [walletClient, address, refresh]
  );

  const revokeKey = useCallback(
    async (params: { keyId: Address; feeToken?: Address }) => {
      if (!walletClient || !address) throw new Error('Wallet not connected');

      const hash = await Actions.accessKey.revoke(walletClient, {
        accessKey: params.keyId,
        feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
      });

      await tempoPublicClient.waitForTransactionReceipt({ hash });
      await refresh();

      return { transactionHash: hash };
    },
    [walletClient, address, refresh]
  );

  const updateSpendingLimit = useCallback(
    async (params: { keyId: Address; token: Address; newLimit: bigint; feeToken?: Address }) => {
      if (!walletClient || !address) throw new Error('Wallet not connected');

      const hash = await Actions.accessKey.updateLimit(walletClient, {
        accessKey: params.keyId,
        token: params.token,
        limit: params.newLimit,
        feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
      });

      await tempoPublicClient.waitForTransactionReceipt({ hash });
      await refresh();

      return { transactionHash: hash };
    },
    [walletClient, address, refresh]
  );

  const getKey = useCallback(
    async (keyId: Address): Promise<AccessKey | null> => {
      if (!address) return null;

      try {
        const keyData = await Actions.accessKey.getMetadata(tempoPublicClient, {
          account: address,
          accessKey: keyId,
        });

        return {
          keyId,
          signatureType: keyData.keyType as AccessKeyType,
          expiry: Number(keyData.expiry),
          enforceLimits: keyData.spendPolicy === 'limited',
          isRevoked: keyData.isRevoked,
        };
      } catch (error) {
        console.error(`Failed to get key ${keyId}:`, error);
        return null;
      }
    },
    [address]
  );

  const getRemainingLimit = useCallback(
    async (
      keyId: Address,
      token: Address
    ): Promise<{ remaining: bigint; periodEnd: bigint } | null> => {
      if (!address) return null;

      // Try T3+ getRemainingLimitWithPeriod first. If it reverts (common for
      // legacy one-time limits where period=0), fall back to the pre-T3
      // getRemainingLimit function which returns a single remaining value.
      try {
        const [remaining, periodEnd] = (await tempoPublicClient.readContract({
          address: ACCOUNT_KEYCHAIN_ADDRESS,
          abi: Abis.accountKeychain,
          functionName: 'getRemainingLimitWithPeriod',
          args: [address, keyId, token],
        })) as [bigint, bigint];
        return { remaining, periodEnd: BigInt(periodEnd) };
      } catch {
        // Fall through to legacy call.
      }

      try {
        const remaining = (await tempoPublicClient.readContract({
          address: ACCOUNT_KEYCHAIN_ADDRESS,
          abi: Abis.accountKeychain,
          functionName: 'getRemainingLimit',
          args: [address, keyId, token],
        })) as bigint;
        // Legacy one-time limit: no period, but a limit IS configured.
        // Surface a non-zero periodEnd sentinel so the UI treats it as "limit set".
        return { remaining, periodEnd: remaining > 0n ? 1n : 0n };
      } catch {
        return null;
      }
    },
    [address]
  );

  return {
    keys,
    isLoading,
    authorizeKey,
    revokeKey,
    updateSpendingLimit,
    getKey,
    getRemainingLimit,
    refresh,
  };
}
