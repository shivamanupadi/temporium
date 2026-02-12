import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWalletClient, useAccount } from 'wagmi';
import {
  getPoliciesByOwner,
  savePolicy,
  deletePolicy,
  getPolicyByPolicyId,
} from '@/lib/policies-storage';
import { Actions, tempoPublicClient } from '@/lib/tempo-client';
import { DEFAULT_FEE_TOKEN_ADDRESS } from '@/lib/constants';
import type { Address } from 'viem';
import type { Policy, PolicyType } from '@/types';

export const POLICIES_QUERY_KEY = 'policies';

export interface PolicyWithMetadata extends Policy {
  isAdmin?: boolean;
}

interface UsePoliciesReturn {
  policies: PolicyWithMetadata[];
  isLoading: boolean;

  createPolicy: (params: {
    type: PolicyType;
    addresses?: readonly Address[];
    feeToken?: Address;
  }) => Promise<{ policy: Policy; receipt: { transactionHash: string } }>;
  importPolicy: (params: { policyId: bigint }) => Promise<Policy>;
  removePolicy: (id: string) => Promise<void>;

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

  // Step 1: Fetch policies from API (fast)
  const { data: storedPolicies = [], isLoading: isLoadingPolicies } = useQuery({
    queryKey: [POLICIES_QUERY_KEY, address],
    queryFn: async (): Promise<Policy[]> => {
      if (!address) return [];
      return getPoliciesByOwner();
    },
    enabled: !!address,
    staleTime: 30000,
  });

  // Step 2: Fetch on-chain metadata in background (slow, non-blocking)
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
    staleTime: 60000,
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

      const policy = await savePolicy({
        owner: address,
        policyId: result.policyId.toString(),
        type: params.type,
        admin: address,
        txHash: result.receipt.transactionHash,
      });

      await refresh();

      return { policy, receipt: result.receipt };
    },
    [walletClient, address, refresh]
  );

  const importPolicy = useCallback(
    async (params: { policyId: bigint }) => {
      if (!address) throw new Error('Wallet not connected');

      const existing = await getPolicyByPolicyId(params.policyId.toString());
      if (existing) {
        throw new Error('This policy is already in your list');
      }

      const policyData = await Actions.policy.getData(tempoPublicClient, {
        policyId: params.policyId,
      });

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
      await deletePolicy(id);
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

      const policyData = await Actions.policy.getData(tempoPublicClient, {
        policyId: params.policyId,
      });

      if (policyData.admin.toLowerCase() !== address.toLowerCase()) {
        throw new Error('You do not have admin access to this policy');
      }

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

      const policyData = await Actions.policy.getData(tempoPublicClient, {
        policyId: params.policyId,
      });

      if (policyData.admin.toLowerCase() !== address.toLowerCase()) {
        throw new Error('You do not have admin access to this policy');
      }

      const isAuthorized = await Actions.policy.isAuthorized(tempoPublicClient, {
        policyId: params.policyId,
        user: params.address,
      });

      if (params.restricted && !isAuthorized) {
        throw new Error('This address is already blacklisted');
      }

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
