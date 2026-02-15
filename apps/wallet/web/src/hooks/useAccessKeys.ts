import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWalletClient, useAccount } from 'wagmi';
import { tempoPublicClient } from '@/lib/tempo-client';
import { ACCOUNT_KEYCHAIN_ADDRESS } from '@/lib/constants';
import { getSignatureTypeLabel } from '@/lib/access-keys-utils';
import { Abis } from 'viem/tempo';
import type { Address } from 'viem';
import type { AccessKey } from '@/types';

export const ACCESS_KEYS_QUERY_KEY = 'accessKeys';

export interface AccessKeyWithMetadata extends AccessKey {
  publicKeyHash?: `0x${string}`;
}

interface UseAccessKeysReturn {
  keys: AccessKeyWithMetadata[];
  isLoading: boolean;

  authorizeKey: (params: {
    keyId: Address;
    signatureType: number;
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
  getRemainingLimit: (keyId: Address, token: Address) => Promise<bigint>;

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
        const currentBlock = await tempoPublicClient.getBlockNumber();
        const fromBlock = currentBlock > 99000n ? currentBlock - 99000n : 0n;

        const logs = await tempoPublicClient.getLogs({
          address: ACCOUNT_KEYCHAIN_ADDRESS,
          event: {
            type: 'event',
            name: 'KeyAuthorized',
            inputs: [
              { type: 'address', name: 'account', indexed: true },
              { type: 'address', name: 'publicKey', indexed: true },
              { type: 'uint8', name: 'signatureType' },
              { type: 'uint64', name: 'expiry' },
            ],
          },
          args: {
            account: address,
          },
          fromBlock,
          toBlock: 'latest',
        });

        const keysWithState = await Promise.all(
          logs.map(async log => {
            const keyId = log.args.publicKey as Address;

            try {
              const keyData = (await tempoPublicClient.readContract({
                address: ACCOUNT_KEYCHAIN_ADDRESS,
                abi: Abis.accountKeychain,
                functionName: 'getKey',
                args: [address, keyId],
              })) as {
                signatureType: number;
                keyId: Address;
                expiry: bigint;
                enforceLimits: boolean;
                isRevoked: boolean;
              };

              return {
                keyId,
                signatureType: getSignatureTypeLabel(keyData.signatureType),
                expiry: Number(keyData.expiry),
                enforceLimits: keyData.enforceLimits,
                isRevoked: keyData.isRevoked,
              };
            } catch (error) {
              console.error(`Failed to fetch key data for ${keyId}:`, error);
              return null;
            }
          })
        );

        const validKeys = keysWithState.filter(
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
      signatureType: number;
      expiry: number;
      enforceLimits: boolean;
      limits: { token: Address; amount: bigint }[];
      feeToken?: Address;
    }) => {
      if (!walletClient || !address) throw new Error('Wallet not connected');

      const hash = await walletClient.writeContract({
        address: ACCOUNT_KEYCHAIN_ADDRESS,
        abi: Abis.accountKeychain,
        functionName: 'authorizeKey',
        args: [
          params.keyId,
          params.signatureType,
          BigInt(params.expiry),
          params.enforceLimits,
          params.limits,
        ],
      });

      await tempoPublicClient.waitForTransactionReceipt({ hash });
      await refresh();

      return { transactionHash: hash };
    },
    [walletClient, address, refresh]
  );

  const revokeKey = useCallback(
    async (params: { keyId: Address; feeToken?: Address }) => {
      if (!walletClient || !address) throw new Error('Wallet not connected');

      const hash = await walletClient.writeContract({
        address: ACCOUNT_KEYCHAIN_ADDRESS,
        abi: Abis.accountKeychain,
        functionName: 'revokeKey',
        args: [params.keyId],
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

      const hash = await walletClient.writeContract({
        address: ACCOUNT_KEYCHAIN_ADDRESS,
        abi: Abis.accountKeychain,
        functionName: 'updateSpendingLimit',
        args: [params.keyId, params.token, params.newLimit],
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
        const keyData = (await tempoPublicClient.readContract({
          address: ACCOUNT_KEYCHAIN_ADDRESS,
          abi: Abis.accountKeychain,
          functionName: 'getKey',
          args: [address, keyId],
        })) as {
          signatureType: number;
          keyId: Address;
          expiry: bigint;
          enforceLimits: boolean;
          isRevoked: boolean;
        };

        return {
          keyId,
          signatureType: getSignatureTypeLabel(keyData.signatureType),
          expiry: Number(keyData.expiry),
          enforceLimits: keyData.enforceLimits,
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
    async (keyId: Address, token: Address): Promise<bigint> => {
      if (!address) return 0n;

      try {
        const remaining = await tempoPublicClient.readContract({
          address: ACCOUNT_KEYCHAIN_ADDRESS,
          abi: Abis.accountKeychain,
          functionName: 'getRemainingLimit',
          args: [address, keyId, token],
        });

        return remaining as bigint;
      } catch (error) {
        console.error(`Failed to get remaining limit for ${keyId}:`, error);
        return 0n;
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
