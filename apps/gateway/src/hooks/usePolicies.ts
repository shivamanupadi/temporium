import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWalletClient, useAccount } from 'wagmi';
import {
  getPoliciesByOwner,
  savePolicy,
  deletePolicy,
  updatePolicyAdmin,
  getPolicyByPolicyId,
  type Policy,
} from '@/lib/policies-storage';
import { Actions, tempoPublicClient } from '@/lib/tempo-client';
import { DEFAULT_FEE_TOKEN_ADDRESS } from '@/lib/constants';
import type { Address } from 'viem';
import type { PolicyType } from '@/types';

// Query key for policies - used for cache invalidation
export const POLICIES_QUERY_KEY = 'policies';

export interface PolicyWithMetadata extends Policy {
  isAdmin?: boolean;
}

interface UsePoliciesReturn {
  policies: PolicyWithMetadata[];
  isLoading: boolean;

  // Lifecycle
  createPolicy: (params: {
    type: PolicyType;
    addresses?: readonly Address[];
    feeToken?: Address;
  }) => Promise<{ policy: Policy; receipt: { transactionHash: string } }>;
  importPolicy: (params: { policyId: bigint }) => Promise<Policy>;
  removePolicy: (id: string) => Promise<void>;

  // Management
  modifyWhitelist: (params: {
    policyId: bigint;
    address: Address;
    allowed: boolean;
    feeToken?: Address;
  }) => Promise<{ receipt: { transactionHash: string } }>;
  modifyBlacklist: (params: {
    policyId: bigint;
    address: Address;
    restricted: boolean;
    feeToken?: Address;
  }) => Promise<{ receipt: { transactionHash: string } }>;
  transferAdmin: (params: {
    policyId: bigint;
    admin: Address;
    feeToken?: Address;
  }) => Promise<{ receipt: { transactionHash: string } }>;
  checkAuthorization: (params: { policyId: bigint; user: Address }) => Promise<boolean>;

  // Token Integration
  linkToToken: (params: {
    token: Address;
    policyId: bigint;
    feeToken?: Address;
  }) => Promise<{ receipt: { transactionHash: string } }>;
  unlinkFromToken: (params: {
    token: Address;
    feeToken?: Address;
  }) => Promise<{ receipt: { transactionHash: string } }>;

  refresh: () => Promise<void>;
}

export function usePolicies(): UsePoliciesReturn {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const queryClient = useQueryClient();

  // Use React Query for policies data - shared across all components
  // Step 1: Fetch policies from API (fast)
  const { data: storedPolicies = [], isLoading: isLoadingPolicies } = useQuery({
    queryKey: [POLICIES_QUERY_KEY, address],
    queryFn: async (): Promise<Policy[]> => {
      if (!address) return [];
      return getPoliciesByOwner(address);
    },
    enabled: !!address,
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  // Step 2: Fetch on-chain metadata in background (slow, but non-blocking)
  const { data: onChainMetadata = {} } = useQuery({
    queryKey: [
      POLICIES_QUERY_KEY,
      'metadata',
      address,
      storedPolicies.map(p => p.policyId).join(','),
    ],
    queryFn: async (): Promise<
      Record<string, { admin: Address; type: 'whitelist' | 'blacklist' }>
    > => {
      if (!address || storedPolicies.length === 0) return {};

      const results: Record<string, { admin: Address; type: 'whitelist' | 'blacklist' }> = {};

      // Fetch in parallel but don't block rendering
      await Promise.allSettled(
        storedPolicies.map(async policy => {
          try {
            const policyData = await Actions.policy.getData(tempoPublicClient, {
              policyId: BigInt(policy.policyId),
            });
            results[policy.policyId] = {
              admin: policyData.admin,
              type: policyData.type,
            };
          } catch (err) {
            console.error(`Failed to fetch policy data for ${policy.policyId}:`, err);
          }
        })
      );

      return results;
    },
    enabled: !!address && storedPolicies.length > 0,
    staleTime: 60000, // Cache for 1 minute
  });

  // Merge stored policies with on-chain metadata
  const policies: PolicyWithMetadata[] = storedPolicies.map(policy => {
    const chainData = onChainMetadata[policy.policyId];
    if (chainData) {
      return {
        ...policy,
        admin: chainData.admin,
        type: chainData.type,
        isAdmin: chainData.admin.toLowerCase() === address?.toLowerCase(),
      };
    }
    return {
      ...policy,
      isAdmin: policy.admin.toLowerCase() === address?.toLowerCase(),
    };
  });

  const isLoading = isLoadingPolicies;

  // Refresh function invalidates both queries, triggering refetch in ALL components
  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: [POLICIES_QUERY_KEY] });
  }, [queryClient]);

  const createPolicy = useCallback(
    async (params: { type: PolicyType; addresses?: readonly Address[]; feeToken?: Address }) => {
      if (!walletClient || !address) throw new Error('Wallet not connected');

      const result = await Actions.policy.createSync(walletClient, {
        type: params.type,
        addresses: params.addresses,
        feeToken: params.feeToken ?? DEFAULT_FEE_TOKEN_ADDRESS,
      });

      // Save to local storage
      const policy = await savePolicy({
        owner: address,
        policyId: result.policyId.toString(),
        type: params.type,
        admin: address, // Creator is the initial admin
        txHash: result.receipt.transactionHash,
      });

      // Refresh the list
      await refresh();

      return { policy, receipt: result.receipt };
    },
    [walletClient, address, refresh]
  );

  const importPolicy = useCallback(
    async (params: { policyId: bigint }) => {
      if (!address) throw new Error('Wallet not connected');

      // Check if already imported
      const existing = await getPolicyByPolicyId(params.policyId.toString(), address);
      if (existing) {
        throw new Error('This policy is already in your list');
      }

      // Fetch policy data from chain
      const policyData = await Actions.policy.getData(tempoPublicClient, {
        policyId: params.policyId,
      });

      // Save to IndexedDB
      const policy = await savePolicy({
        owner: address,
        policyId: params.policyId.toString(),
        type: policyData.type,
        admin: policyData.admin,
      });

      await refresh();
      return policy;
    },
    [address, refresh]
  );

  const removePolicy = useCallback(
    async (id: string) => {
      if (!address) throw new Error('Wallet not connected');
      await deletePolicy(id, address);
      await refresh();
    },
    [address, refresh]
  );

  const modifyWhitelist = useCallback(
    async (params: {
      policyId: bigint;
      address: Address;
      allowed: boolean;
      feeToken?: Address;
    }) => {
      if (!walletClient || !address) throw new Error('Wallet not connected');

      // Check if user is admin before attempting modification
      const policyData = await Actions.policy.getData(tempoPublicClient, {
        policyId: params.policyId,
      });

      if (policyData.admin.toLowerCase() !== address.toLowerCase()) {
        throw new Error('You do not have admin access to this policy');
      }

      // Check current authorization status
      const isCurrentlyWhitelisted = await Actions.policy.isAuthorized(tempoPublicClient, {
        policyId: params.policyId,
        user: params.address,
      });

      if (params.allowed && isCurrentlyWhitelisted) {
        throw new Error('This address is already whitelisted');
      }

      if (!params.allowed && !isCurrentlyWhitelisted) {
        throw new Error('This address is not in the whitelist');
      }

      const result = await Actions.policy.modifyWhitelistSync(walletClient, {
        policyId: params.policyId,
        address: params.address,
        allowed: params.allowed,
        feeToken: params.feeToken ?? DEFAULT_FEE_TOKEN_ADDRESS,
      });

      await refresh();
      return result;
    },
    [walletClient, address, refresh]
  );

  const modifyBlacklist = useCallback(
    async (params: {
      policyId: bigint;
      address: Address;
      restricted: boolean;
      feeToken?: Address;
    }) => {
      if (!walletClient || !address) throw new Error('Wallet not connected');

      // Check if user is admin before attempting modification
      const policyData = await Actions.policy.getData(tempoPublicClient, {
        policyId: params.policyId,
      });

      if (policyData.admin.toLowerCase() !== address.toLowerCase()) {
        throw new Error('You do not have admin access to this policy');
      }

      // Check current authorization status (blacklisted = not authorized)
      const isAuthorized = await Actions.policy.isAuthorized(tempoPublicClient, {
        policyId: params.policyId,
        user: params.address,
      });

      // If restricted=true (adding to blacklist) and already not authorized, address is already blacklisted
      if (params.restricted && !isAuthorized) {
        throw new Error('This address is already blacklisted');
      }

      // If restricted=false (removing from blacklist) and authorized, address is not blacklisted
      if (!params.restricted && isAuthorized) {
        throw new Error('This address is not in the blacklist');
      }

      const result = await Actions.policy.modifyBlacklistSync(walletClient, {
        policyId: params.policyId,
        address: params.address,
        restricted: params.restricted,
        feeToken: params.feeToken ?? DEFAULT_FEE_TOKEN_ADDRESS,
      });

      await refresh();
      return result;
    },
    [walletClient, address, refresh]
  );

  const transferAdmin = useCallback(
    async (params: { policyId: bigint; admin: Address; feeToken?: Address }) => {
      if (!walletClient || !address) throw new Error('Wallet not connected');

      // Check if user is admin before attempting transfer
      const policyData = await Actions.policy.getData(tempoPublicClient, {
        policyId: params.policyId,
      });

      if (policyData.admin.toLowerCase() !== address.toLowerCase()) {
        throw new Error('You do not have admin access to this policy');
      }

      const result = await Actions.policy.setAdminSync(walletClient, {
        policyId: params.policyId,
        admin: params.admin,
        feeToken: params.feeToken ?? DEFAULT_FEE_TOKEN_ADDRESS,
      });

      // Update local storage with new admin
      const stored = await getPoliciesByOwner(address);
      const policy = stored.find(p => p.policyId === params.policyId.toString());
      if (policy) {
        await updatePolicyAdmin(policy.id, address, params.admin);
      }

      await refresh();
      return result;
    },
    [walletClient, address, refresh]
  );

  const checkAuthorization = useCallback(async (params: { policyId: bigint; user: Address }) => {
    const authorized = await Actions.policy.isAuthorized(tempoPublicClient, {
      policyId: params.policyId,
      user: params.user,
    });
    return authorized;
  }, []);

  const linkToToken = useCallback(
    async (params: { token: Address; policyId: bigint; feeToken?: Address }) => {
      if (!walletClient || !address) throw new Error('Wallet not connected');

      // Check if user has admin role for the token before attempting to link
      const hasAdminRole = await Actions.token.hasRole(tempoPublicClient, {
        token: params.token,
        account: address,
        role: 'defaultAdmin',
      });

      if (!hasAdminRole) {
        throw new Error('You do not have the Admin role required to change transfer policy');
      }

      const result = await Actions.token.changeTransferPolicySync(walletClient, {
        token: params.token,
        policyId: params.policyId,
        feeToken: params.feeToken ?? DEFAULT_FEE_TOKEN_ADDRESS,
      });

      return result;
    },
    [walletClient, address]
  );

  const unlinkFromToken = useCallback(
    async (params: { token: Address; feeToken?: Address }) => {
      if (!walletClient || !address) throw new Error('Wallet not connected');

      // Check if user has admin role for the token before attempting to unlink
      const hasAdminRole = await Actions.token.hasRole(tempoPublicClient, {
        token: params.token,
        account: address,
        role: 'defaultAdmin',
      });

      if (!hasAdminRole) {
        throw new Error('You do not have the Admin role required to change transfer policy');
      }

      // Set policy ID to 1 (always-allow) to remove restrictions
      const result = await Actions.token.changeTransferPolicySync(walletClient, {
        token: params.token,
        policyId: 1n,
        feeToken: params.feeToken ?? DEFAULT_FEE_TOKEN_ADDRESS,
      });

      return result;
    },
    [walletClient, address]
  );

  return {
    policies,
    isLoading,
    createPolicy,
    importPolicy,
    removePolicy,
    modifyWhitelist,
    modifyBlacklist,
    transferAdmin,
    checkAuthorization,
    linkToToken,
    unlinkFromToken,
    refresh,
  };
}

// Hook to get a single policy by ID
export function usePolicy(
  policyId: string | undefined
): Omit<UsePoliciesReturn, 'policies'> & { policy: PolicyWithMetadata | undefined } {
  const { policies, isLoading, ...rest } = usePolicies();

  const policy = policies.find(p => p.policyId === policyId);

  return {
    policy,
    isLoading,
    ...rest,
  };
}
