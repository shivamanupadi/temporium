import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWalletClient, useAccount } from 'wagmi';
import { tempoPublicClient, Actions } from '@/lib/tempo-client';
import { DEFAULT_FEE_TOKEN_ADDRESS, ACCOUNT_KEYCHAIN_ADDRESS } from '@/lib/constants';
import { getSignatureTypeNumber } from '@/lib/access-keys-utils';
import { apiGet, apiPost, apiPatch } from '@/lib/api-client';
import { Abis } from 'viem/tempo';
import type { Address } from 'viem';
import type { AccessKey, AccessKeyType } from '@/types';

/** A spending limit entry, optionally periodic. period=0 means one-time (legacy). */
export interface SpendingLimitInput {
  token: Address;
  amount: bigint;
  /** Refresh period in seconds. 0 = one-time. Default 0. */
  period?: number;
}

/** A scope entry restricting which contract calls a key can make. */
export interface AllowedCallScope {
  /** Target contract address. */
  target: Address;
  /** Selectors allowed on this target. Empty = all selectors. */
  selectors?: `0x${string}`[];
  /** Per-selector recipient allowlists. Keyed by selector. */
  selectorRecipients?: Record<string, Address[]>;
}

export const ACCESS_KEYS_QUERY_KEY = 'accessKeys';

export interface AccessKeyWithMetadata extends AccessKey {
  dbId?: string;
  label?: string;
  notes?: string;
  lastUsedAt?: string;
  lastUsedIp?: string;
  lastUsedNetwork?: string;
  createdAt?: string;
}

interface DbAccessKey {
  id: string;
  owner: string;
  keyId: string;
  signatureType: string;
  txHash: string | null;
  label: string | null;
  notes: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  lastUsedNetwork: string | null;
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
    limits: SpendingLimitInput[];
    /** Optional call scopes; if provided, set via setAllowedCalls after authorize. */
    allowedCalls?: AllowedCallScope[];
    label?: string;
    notes?: string;
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

  /** Set / replace the allowedCalls scopes for a key. */
  setAllowedCalls: (params: {
    keyId: Address;
    scopes: AllowedCallScope[];
    feeToken?: Address;
  }) => Promise<{ transactionHash: `0x${string}` }>;

  /** Read the on-chain allowedCalls scopes for a key. */
  getAllowedCalls: (keyId: Address) => Promise<AllowedCallScope[]>;

  /** Update db-only metadata (label, notes). */
  updateKeyMetadata: (params: {
    dbId: string;
    label?: string;
    notes?: string;
  }) => Promise<DbAccessKey>;

  /** Stamp last-used. Idempotent; safe to call from request middleware. */
  touchKey: (params: { keyId: Address; network?: 'testnet' | 'mainnet' }) => Promise<void>;

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
                notes: dbKey.notes ?? undefined,
                lastUsedAt: dbKey.lastUsedAt ?? undefined,
                lastUsedIp: dbKey.lastUsedIp ?? undefined,
                lastUsedNetwork: dbKey.lastUsedNetwork ?? undefined,
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
      limits: SpendingLimitInput[];
      allowedCalls?: AllowedCallScope[];
      label?: string;
      notes?: string;
      feeToken?: Address;
    }) => {
      if (!walletClient || !address) throw new Error('Wallet not connected');

      // authorize requires off-chain key authorization signing which needs
      // a LocalAccount. wagmi provides JsonRpcAccount, so we use writeContract
      // directly against the new 3-arg `authorizeKey(keyId, signatureType, config)`
      // overload. The legacy 5-arg form was retired on mainnet (selector
      // changed to 0x980a6025); calling it now reverts with
      // `LegacyAuthorizeKeySelectorChanged`. Scopes (`allowedCalls`) live
      // inside `config` here, so we no longer need a follow-up `setAllowedCalls` tx.
      const allowedCallsConfig = (params.allowedCalls ?? []).map(s => ({
        target: s.target,
        selectorRules: (s.selectors ?? []).map(sel => ({
          selector: sel,
          recipients: s.selectorRecipients?.[sel.toLowerCase()] ?? [],
        })),
      }));

      const hash = await walletClient.writeContract({
        address: ACCOUNT_KEYCHAIN_ADDRESS,
        abi: Abis.accountKeychain,
        functionName: 'authorizeKey',
        args: [
          params.keyId,
          getSignatureTypeNumber(params.keyType),
          {
            expiry: BigInt(params.expiry),
            enforceLimits: params.enforceLimits,
            limits: params.enforceLimits
              ? params.limits.map(l => ({
                  token: l.token,
                  amount: l.amount,
                  period: BigInt(l.period ?? 0),
                }))
              : [],
            // If no explicit scope list was provided, allow any call. Otherwise
            // restrict to exactly the scopes the user configured.
            allowAnyCalls: allowedCallsConfig.length === 0,
            allowedCalls: allowedCallsConfig,
          },
        ],
        feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
      } as any);

      await tempoPublicClient.waitForTransactionReceipt({ hash });

      try {
        await apiPost('/v1/access-keys', {
          keyId: params.keyId,
          signatureType: params.keyType,
          txHash: hash,
          label: params.label,
          notes: params.notes,
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

      // updateSpendingLimit is strictly (keyId, token, newLimit) on-chain — the
      // period is locked at authorizeKey time and cannot be changed after the
      // fact. Updating only the amount preserves whatever periodic schedule the
      // key was authorized with.
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

  const setAllowedCalls = useCallback(
    async (params: { keyId: Address; scopes: AllowedCallScope[]; feeToken?: Address }) => {
      if (!walletClient || !address) throw new Error('Wallet not connected');

      const hash = await walletClient.writeContract({
        address: ACCOUNT_KEYCHAIN_ADDRESS,
        abi: Abis.accountKeychain,
        functionName: 'setAllowedCalls',
        args: [
          params.keyId,
          params.scopes.map(s => ({
            target: s.target,
            selectorRules: (s.selectors ?? []).map(sel => ({
              selector: sel,
              recipients: s.selectorRecipients?.[sel.toLowerCase()] ?? [],
            })),
          })),
        ],
        feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
      } as any);

      await tempoPublicClient.waitForTransactionReceipt({ hash });
      await refresh();

      return { transactionHash: hash };
    },
    [walletClient, address, refresh]
  );

  const getAllowedCalls = useCallback(
    async (keyId: Address): Promise<AllowedCallScope[]> => {
      if (!address) return [];

      try {
        // ABI returns a tuple [hasScopes, scopes[]]. We only care about the
        // scopes payload — when hasScopes is false the array is empty.
        const result = (await tempoPublicClient.readContract({
          address: ACCOUNT_KEYCHAIN_ADDRESS,
          abi: Abis.accountKeychain,
          functionName: 'getAllowedCalls',
          args: [address, keyId],
        })) as unknown as readonly [
          boolean,
          readonly {
            target: Address;
            selectorRules: readonly { selector: `0x${string}`; recipients: readonly Address[] }[];
          }[],
        ];
        const raw = result[1];

        return raw.map(scope => {
          const selectorRecipients: Record<string, Address[]> = {};
          for (const rule of scope.selectorRules) {
            selectorRecipients[rule.selector.toLowerCase()] = [...rule.recipients];
          }
          return {
            target: scope.target,
            selectors: scope.selectorRules.map(r => r.selector),
            selectorRecipients,
          };
        });
      } catch (error) {
        // Likely the key was authorized without scopes, or contract is pre-T3.
        console.warn(`getAllowedCalls failed for ${keyId}:`, error);
        return [];
      }
    },
    [address]
  );

  const updateKeyMetadata = useCallback(
    async (params: { dbId: string; label?: string; notes?: string }): Promise<DbAccessKey> => {
      const body: Record<string, string> = {};
      if (params.label !== undefined) body.label = params.label;
      if (params.notes !== undefined) body.notes = params.notes;
      const result = await apiPatch<DbAccessKey>(`/v1/access-keys/${params.dbId}`, body);
      await refresh();
      return result;
    },
    [refresh]
  );

  const touchKey = useCallback(
    async (params: { keyId: Address; network?: 'testnet' | 'mainnet' }): Promise<void> => {
      if (!address) return;
      try {
        await apiPost(`/v1/access-keys/by-key/${params.keyId}/touch`, {
          network: params.network,
        });
      } catch (error) {
        // Best-effort: never let last-used tracking break the actual call.
        console.warn('touchKey failed:', error);
      }
    },
    [address]
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
    setAllowedCalls,
    getAllowedCalls,
    updateKeyMetadata,
    touchKey,
    getKey,
    getRemainingLimit,
    refresh,
  };
}
