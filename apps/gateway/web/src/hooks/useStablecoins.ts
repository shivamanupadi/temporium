import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWalletClient, useAccount } from 'wagmi';
import {
  getStablecoinsByOwner,
  saveStablecoin,
  deleteStablecoin,
  type Stablecoin,
} from '@/lib/tip20-contracts-storage';
import { Actions, tempoPublicClient } from '@/lib/tempo-client';
import { DEFAULT_FEE_TOKEN_ADDRESS } from '@/lib/constants';
import type { Address } from 'viem';
import type { TokenRole } from '@/types';

// Query key for stablecoins - used for cache invalidation
export const STABLECOINS_QUERY_KEY = 'stablecoins';

export interface TokenMetadata {
  name: string;
  symbol: string;
  currency: string;
  decimals: number;
  paused?: boolean;
  supplyCap?: bigint;
  totalSupply: bigint;
  quoteToken?: Address;
  transferPolicyId?: bigint;
}

export interface StablecoinWithMetadata extends Stablecoin {
  metadata?: TokenMetadata;
  userBalance?: bigint;
  userRoles?: TokenRole[];
}

interface UseStablecoinsReturn {
  stablecoins: StablecoinWithMetadata[];
  isLoading: boolean;
  createStablecoin: (params: {
    name: string;
    symbol: string;
    currency: string;
    feeToken?: Address;
  }) => Promise<{ stablecoin: Stablecoin; receipt: { transactionHash: string } }>;
  importStablecoin: (params: {
    address: Address;
    name: string;
    symbol: string;
    currency: string;
  }) => Promise<Stablecoin>;
  mintTokens: (params: {
    token: Address;
    to: Address;
    amount: bigint;
    feeToken?: Address;
  }) => Promise<{ receipt: { transactionHash: string } }>;
  burnTokens: (params: {
    token: Address;
    amount: bigint;
    feeToken?: Address;
  }) => Promise<{ receipt: { transactionHash: string } }>;
  sendTokens: (params: {
    token: Address;
    to: Address;
    amount: bigint;
    feeToken?: Address;
  }) => Promise<{ transactionHash: string }>;
  pauseToken: (params: {
    token: Address;
    feeToken?: Address;
  }) => Promise<{ receipt: { transactionHash: string } }>;
  unpauseToken: (params: {
    token: Address;
    feeToken?: Address;
  }) => Promise<{ receipt: { transactionHash: string } }>;
  setSupplyCap: (params: {
    token: Address;
    supplyCap: bigint;
    feeToken?: Address;
  }) => Promise<{ receipt: { transactionHash: string } }>;
  grantRoles: (params: {
    token: Address;
    to: Address;
    roles: readonly TokenRole[];
    feeToken?: Address;
  }) => Promise<{ receipt: { transactionHash: string } }>;
  revokeRoles: (params: {
    token: Address;
    from: Address;
    roles: readonly TokenRole[];
  }) => Promise<{ receipt: { transactionHash: string } }>;
  checkRole: (params: { token: Address; account: Address; role: TokenRole }) => Promise<boolean>;
  burnBlocked: (params: {
    token: Address;
    from: Address;
    amount: bigint;
    feeToken?: Address;
  }) => Promise<{ receipt: { transactionHash: string } }>;
  changeTransferPolicy: (params: {
    token: Address;
    policyId: bigint;
    feeToken?: Address;
  }) => Promise<{ receipt: { transactionHash: string } }>;
  removeStablecoin: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useStablecoins(): UseStablecoinsReturn {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const queryClient = useQueryClient();

  // All possible roles to check
  const allRoles: TokenRole[] = ['issuer', 'pause', 'unpause', 'burnBlocked', 'defaultAdmin'];

  // Use React Query for stablecoins data - shared across all components
  const { data: stablecoins = [], isLoading } = useQuery({
    queryKey: [STABLECOINS_QUERY_KEY, address],
    queryFn: async (): Promise<StablecoinWithMetadata[]> => {
      if (!address) return [];

      const stored = await getStablecoinsByOwner(address);

      // Fetch metadata for each stablecoin
      const withMetadata = await Promise.all(
        stored.map(async coin => {
          try {
            const [metadata, balance, ...roleResults] = await Promise.all([
              Actions.token.getMetadata(tempoPublicClient, { token: coin.address }),
              Actions.token.getBalance(tempoPublicClient, {
                token: coin.address,
                account: address,
              }),
              ...allRoles.map(role =>
                Actions.token.hasRole(tempoPublicClient, {
                  token: coin.address,
                  account: address,
                  role,
                })
              ),
            ]);
            // Filter roles where user has the role
            const userRoles = allRoles.filter((_, index) => roleResults[index]);
            return {
              ...coin,
              metadata: metadata as TokenMetadata,
              userBalance: balance,
              userRoles,
            };
          } catch (err) {
            console.error(`Failed to fetch metadata for ${coin.address}:`, err);
            return coin;
          }
        })
      );

      return withMetadata;
    },
    enabled: !!address,
    staleTime: 10000, // Consider data fresh for 10 seconds
  });

  // Refresh function invalidates the query, triggering refetch in ALL components
  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: [STABLECOINS_QUERY_KEY, address] });
  }, [queryClient, address]);

  const createStablecoin = useCallback(
    async (params: { name: string; symbol: string; currency: string; feeToken?: Address }) => {
      if (!walletClient || !address) throw new Error('Wallet not connected');

      const result = await Actions.token.createSync(walletClient, {
        name: params.name,
        symbol: params.symbol,
        currency: params.currency,
        feeToken: params.feeToken ?? DEFAULT_FEE_TOKEN_ADDRESS,
      });

      // The result contains the token address from the Create event
      const tokenAddress = result.token as Address;

      // Save to local storage
      const stablecoin = await saveStablecoin({
        owner: address,
        address: tokenAddress.toLowerCase() as Address,
        name: params.name,
        symbol: params.symbol,
        currency: params.currency,
        creator: address.toLowerCase() as Address,
        txHash: result.receipt.transactionHash,
      });

      // Refresh the list - invalidates query cache for all components
      await refresh();

      return { stablecoin, receipt: result.receipt };
    },
    [walletClient, address, refresh]
  );

  const mintTokens = useCallback(
    async (params: { token: Address; to: Address; amount: bigint; feeToken?: Address }) => {
      if (!walletClient || !address) throw new Error('Wallet not connected');

      // Check if user has issuer role before attempting mint
      const hasIssuerRole = await Actions.token.hasRole(tempoPublicClient, {
        token: params.token,
        account: address,
        role: 'issuer',
      });

      if (!hasIssuerRole) {
        throw new Error('You do not have the Issuer role required to mint tokens');
      }

      const result = await Actions.token.mintSync(walletClient, {
        token: params.token,
        to: params.to,
        amount: params.amount,
        feeToken: params.feeToken ?? DEFAULT_FEE_TOKEN_ADDRESS,
      });

      await refresh();
      return result;
    },
    [walletClient, address, refresh]
  );

  const burnTokens = useCallback(
    async (params: { token: Address; amount: bigint; feeToken?: Address }) => {
      if (!walletClient) throw new Error('Wallet not connected');

      const result = await Actions.token.burnSync(walletClient, {
        token: params.token,
        amount: params.amount,
        feeToken: params.feeToken ?? DEFAULT_FEE_TOKEN_ADDRESS,
      });

      await refresh();
      return result;
    },
    [walletClient, refresh]
  );

  const sendTokens = useCallback(
    async (params: { token: Address; to: Address; amount: bigint; feeToken?: Address }) => {
      if (!walletClient) throw new Error('Wallet not connected');

      const hash = await Actions.token.transfer(walletClient, {
        token: params.token,
        to: params.to,
        amount: params.amount,
        feeToken: params.feeToken ?? DEFAULT_FEE_TOKEN_ADDRESS,
      });

      await refresh();
      return { transactionHash: hash };
    },
    [walletClient, refresh]
  );

  const pauseToken = useCallback(
    async (params: { token: Address; feeToken?: Address }) => {
      if (!walletClient || !address) throw new Error('Wallet not connected');

      const hasPauseRole = await Actions.token.hasRole(tempoPublicClient, {
        token: params.token,
        account: address,
        role: 'pause',
      });

      if (!hasPauseRole) {
        throw new Error('You do not have the Pause role required to pause this token');
      }

      const result = await Actions.token.pauseSync(walletClient, {
        token: params.token,
        feeToken: params.feeToken ?? DEFAULT_FEE_TOKEN_ADDRESS,
      });
      await refresh();
      return result;
    },
    [walletClient, address, refresh]
  );

  const unpauseToken = useCallback(
    async (params: { token: Address; feeToken?: Address }) => {
      if (!walletClient || !address) throw new Error('Wallet not connected');

      const hasUnpauseRole = await Actions.token.hasRole(tempoPublicClient, {
        token: params.token,
        account: address,
        role: 'unpause',
      });

      if (!hasUnpauseRole) {
        throw new Error('You do not have the Unpause role required to unpause this token');
      }

      const result = await Actions.token.unpauseSync(walletClient, {
        token: params.token,
        feeToken: params.feeToken ?? DEFAULT_FEE_TOKEN_ADDRESS,
      });
      await refresh();
      return result;
    },
    [walletClient, address, refresh]
  );

  const setSupplyCap = useCallback(
    async (params: { token: Address; supplyCap: bigint; feeToken?: Address }) => {
      if (!walletClient) throw new Error('Wallet not connected');

      const result = await Actions.token.setSupplyCapSync(walletClient, {
        token: params.token,
        supplyCap: params.supplyCap,
        feeToken: params.feeToken ?? DEFAULT_FEE_TOKEN_ADDRESS,
      });

      await refresh();
      return result;
    },
    [walletClient, refresh]
  );

  const importStablecoin = useCallback(
    async (params: { address: Address; name: string; symbol: string; currency: string }) => {
      if (!address) throw new Error('Wallet not connected');

      // Check if already imported
      const existing = await getStablecoinsByOwner(address);
      const alreadyExists = existing.some(
        coin => coin.address.toLowerCase() === params.address.toLowerCase()
      );

      if (alreadyExists) {
        throw new Error('This stablecoin is already in your list');
      }

      // Save to IndexedDB
      const stablecoin = await saveStablecoin({
        owner: address,
        address: params.address.toLowerCase() as Address,
        name: params.name,
        symbol: params.symbol,
        currency: params.currency,
        creator: address.toLowerCase() as Address, // Use current user as creator for imported tokens
        txHash: 'imported', // Mark as imported
      });

      await refresh();
      return stablecoin;
    },
    [address, refresh]
  );

  const removeStablecoin = useCallback(
    async (id: string) => {
      if (!address) throw new Error('Wallet not connected');
      await deleteStablecoin(id, address);
      await refresh();
    },
    [address, refresh]
  );

  const grantRoles = useCallback(
    async (params: {
      token: Address;
      roles: readonly TokenRole[];
      to: Address;
      feeToken?: Address;
    }) => {
      if (!walletClient || !address) throw new Error('Wallet not connected');

      const hasAdminRole = await Actions.token.hasRole(tempoPublicClient, {
        token: params.token,
        account: address,
        role: 'defaultAdmin',
      });

      if (!hasAdminRole) {
        throw new Error('You do not have the Admin role required to grant roles');
      }

      const result = await Actions.token.grantRolesSync(walletClient, {
        token: params.token,
        roles: params.roles,
        to: params.to,
        feeToken: params.feeToken ?? DEFAULT_FEE_TOKEN_ADDRESS,
      });

      return result;
    },
    [walletClient, address]
  );

  const revokeRoles = useCallback(
    async (params: { token: Address; roles: readonly TokenRole[]; from: Address }) => {
      if (!walletClient || !address) throw new Error('Wallet not connected');

      // Only check admin role if revoking from someone else
      // Revoking your own roles doesn't require admin
      const isRevokingFromSelf = params.from.toLowerCase() === address.toLowerCase();

      if (!isRevokingFromSelf) {
        const hasAdminRole = await Actions.token.hasRole(tempoPublicClient, {
          token: params.token,
          account: address,
          role: 'defaultAdmin',
        });

        if (!hasAdminRole) {
          throw new Error('You do not have the Admin role required to revoke roles from others');
        }
      }

      const result = await Actions.token.revokeRolesSync(walletClient, {
        token: params.token,
        roles: params.roles,
        from: params.from,
      });

      return result;
    },
    [walletClient, address]
  );

  const checkRole = useCallback(
    async (params: { token: Address; account: Address; role: TokenRole }) => {
      const hasRole = await Actions.token.hasRole(tempoPublicClient, {
        token: params.token,
        account: params.account,
        role: params.role,
      });

      return hasRole;
    },
    []
  );

  const burnBlocked = useCallback(
    async (params: { token: Address; from: Address; amount: bigint; feeToken?: Address }) => {
      if (!walletClient || !address) throw new Error('Wallet not connected');

      const hasBurnBlockedRole = await Actions.token.hasRole(tempoPublicClient, {
        token: params.token,
        account: address,
        role: 'burnBlocked',
      });

      if (!hasBurnBlockedRole) {
        throw new Error('You do not have the Burn Blocked role required to burn blocked tokens');
      }

      const result = await Actions.token.burnBlockedSync(walletClient, {
        token: params.token,
        from: params.from,
        amount: params.amount,
        feeToken: params.feeToken ?? DEFAULT_FEE_TOKEN_ADDRESS,
      });

      await refresh();
      return result;
    },
    [walletClient, address, refresh]
  );

  const changeTransferPolicy = useCallback(
    async (params: { token: Address; policyId: bigint; feeToken?: Address }) => {
      if (!walletClient || !address) throw new Error('Wallet not connected');

      // Check if user has admin role
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

      await refresh();
      return result;
    },
    [walletClient, address, refresh]
  );

  return {
    stablecoins,
    isLoading,
    createStablecoin,
    importStablecoin,
    mintTokens,
    burnTokens,
    sendTokens,
    pauseToken,
    unpauseToken,
    setSupplyCap,
    grantRoles,
    revokeRoles,
    checkRole,
    burnBlocked,
    changeTransferPolicy,
    removeStablecoin,
    refresh,
  };
}

// Hook to get metadata for a specific token
export function useTokenMetadata(
  tokenAddress: Address | undefined
): ReturnType<typeof useQuery<TokenMetadata | null>> {
  return useQuery({
    queryKey: ['tokenMetadata', tokenAddress],
    queryFn: async () => {
      if (!tokenAddress) return null;
      const metadata = await Actions.token.getMetadata(tempoPublicClient, { token: tokenAddress });
      return metadata as TokenMetadata;
    },
    enabled: !!tokenAddress,
  });
}
