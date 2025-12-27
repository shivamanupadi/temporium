import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWalletClient, useAccount } from 'wagmi';
import { tempoPublicClient } from '@/lib/tempo-client';
import { ACCOUNT_KEYCHAIN_ADDRESS } from '@/lib/constants';
import { getSignatureTypeLabel } from '@/lib/access-keys-utils';
import { Abis } from 'viem/tempo';
import type { Address } from 'viem';
import type { AccessKey } from '@/types';

// Query key for access keys - used for cache invalidation
export const ACCESS_KEYS_QUERY_KEY = 'accessKeys';

export interface AccessKeyWithMetadata extends AccessKey {
  // Event metadata
  publicKeyHash?: `0x${string}`;
}

interface UseAccessKeysReturn {
  keys: AccessKeyWithMetadata[];
  isLoading: boolean;

  // Create (Root Key only)
  authorizeKey: (params: {
    keyId: Address;
    signatureType: number;
    expiry: number;
    enforceLimits: boolean;
    limits: { token: Address; amount: bigint }[];
    feeToken?: Address;
  }) => Promise<{ transactionHash: `0x${string}` }>;

  // Management (Root Key only)
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

  // View functions
  getKey: (keyId: Address) => Promise<AccessKey | null>;
  getRemainingLimit: (keyId: Address, token: Address) => Promise<bigint>;

  refresh: () => Promise<void>;
}

export function useAccessKeys(): UseAccessKeysReturn {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const queryClient = useQueryClient();

  // Fetch access keys by querying KeyAuthorized events
  const { data: keys = [], isLoading } = useQuery({
    queryKey: [ACCESS_KEYS_QUERY_KEY, address],
    queryFn: async (): Promise<AccessKeyWithMetadata[]> => {
      if (!address) return [];

      try {
        // Get current block number to calculate range (RPC limits to 100k blocks)
        const currentBlock = await tempoPublicClient.getBlockNumber();
        const fromBlock = currentBlock > 99000n ? currentBlock - 99000n : 0n;

        // Get KeyAuthorized events for this account
        // The event emits publicKey as address (the keyId)
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

        // Get current state for each key
        const keysWithState = await Promise.all(
          logs.map(async log => {
            // publicKey in the event is actually the keyId (address type)
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
              // Key might not exist or query failed
              console.error(`Failed to fetch key data for ${keyId}:`, error);
              return null;
            }
          })
        );

        // Filter out null results and remove duplicates (by keyId)
        const validKeys = keysWithState.filter(
          (key): key is NonNullable<typeof key> => key !== null
        ) as AccessKeyWithMetadata[];

        // Deduplicate by keyId (keep the most recent)
        const uniqueKeys = new Map<string, AccessKeyWithMetadata>();
        for (const key of validKeys) {
          uniqueKeys.set(key.keyId.toLowerCase(), key);
        }

        return Array.from(uniqueKeys.values());
      } catch (error) {
        console.error('Failed to fetch access keys:', error);
        return [];
      }
    },
    enabled: !!address,
    staleTime: 10000, // Consider data fresh for 10 seconds
  });

  // Refresh function invalidates the query
  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: [ACCESS_KEYS_QUERY_KEY, address] });
  }, [queryClient, address]);

  // Authorize a new access key
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

      // Wait for transaction to be mined
      await tempoPublicClient.waitForTransactionReceipt({ hash });

      // Refresh the list
      await refresh();

      return { transactionHash: hash };
    },
    [walletClient, address, refresh]
  );

  // Revoke an access key
  const revokeKey = useCallback(
    async (params: { keyId: Address; feeToken?: Address }) => {
      if (!walletClient || !address) throw new Error('Wallet not connected');

      const hash = await walletClient.writeContract({
        address: ACCOUNT_KEYCHAIN_ADDRESS,
        abi: Abis.accountKeychain,
        functionName: 'revokeKey',
        args: [params.keyId],
      });

      // Wait for transaction to be mined
      await tempoPublicClient.waitForTransactionReceipt({ hash });

      // Refresh the list
      await refresh();

      return { transactionHash: hash };
    },
    [walletClient, address, refresh]
  );

  // Update spending limit for a key
  const updateSpendingLimit = useCallback(
    async (params: { keyId: Address; token: Address; newLimit: bigint; feeToken?: Address }) => {
      if (!walletClient || !address) throw new Error('Wallet not connected');

      const hash = await walletClient.writeContract({
        address: ACCOUNT_KEYCHAIN_ADDRESS,
        abi: Abis.accountKeychain,
        functionName: 'updateSpendingLimit',
        args: [params.keyId, params.token, params.newLimit],
      });

      // Wait for transaction to be mined
      await tempoPublicClient.waitForTransactionReceipt({ hash });

      // Refresh the list
      await refresh();

      return { transactionHash: hash };
    },
    [walletClient, address, refresh]
  );

  // Get key data from chain
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

  // Get remaining spending limit for a key and token
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

// Hook to get a single access key by ID
export function useAccessKey(
  keyId: Address | undefined
): Omit<UseAccessKeysReturn, 'keys'> & { key: AccessKeyWithMetadata | undefined } {
  const { keys, isLoading, ...rest } = useAccessKeys();

  const key = keys.find(k => k.keyId.toLowerCase() === keyId?.toLowerCase());

  return {
    key,
    isLoading,
    ...rest,
  };
}
