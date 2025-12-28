import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useQuery, useQueries } from '@tanstack/react-query';
import type { Address } from 'viem';
import { getTokens, getTokenByAddress, type Token } from '@/lib/tokenlist';
import { getTokenBalance } from '@/lib/tempo-client';
import { TIMING } from '@/lib/constants';

interface UseTokenListReturn {
  tokens: Token[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to fetch the full tokenlist
 * Uses React Query for caching
 */
export function useTokenList(): UseTokenListReturn {
  const {
    data: tokens = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['tokenlist'],
    queryFn: getTokens,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return { tokens, isLoading, error: error as Error | null };
}

interface UseTokenReturn {
  token: Token | null;
  isLoading: boolean;
}

/**
 * Hook to get token metadata by address
 * Uses React Query for caching
 */
export function useToken(address: Address | undefined): UseTokenReturn {
  const { data: token = null, isLoading } = useQuery({
    queryKey: ['token', address],
    queryFn: () => getTokenByAddress(address!),
    enabled: !!address,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return { token, isLoading };
}

interface TokenWithBalance extends Token {
  balance: bigint;
}

interface UseTokensWithBalancesReturn {
  tokens: TokenWithBalance[];
  totalBalance: bigint;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to get all tokens with their balances
 * Uses React Query for caching and tempo.ts hooks for balance fetching
 */
export function useTokensWithBalances(): UseTokensWithBalancesReturn {
  const { address: accountAddress } = useAccount();
  const { tokens, isLoading: tokensLoading, error } = useTokenList();

  // Fetch balances for all tokens using useQueries with React Query caching
  const balanceQueries = useQueries({
    queries: tokens.map(token => ({
      queryKey: ['tokenBalance', token.address, accountAddress],
      queryFn: () => getTokenBalance(token.address, accountAddress!),
      enabled: !!accountAddress && tokens.length > 0,
      refetchInterval: TIMING.BALANCE_REFRESH_MS,
      staleTime: 5000,
    })),
  });

  const balancesLoading = balanceQueries.some(q => q.isLoading);

  const tokensWithBalances = useMemo((): TokenWithBalance[] => {
    return tokens.map((token, index) => ({
      ...token,
      balance: balanceQueries[index]?.data ?? 0n,
    }));
  }, [tokens, balanceQueries]);

  const totalBalance = useMemo(() => {
    return tokensWithBalances.reduce((sum, token) => sum + token.balance, 0n);
  }, [tokensWithBalances]);

  const refetch = (): void => {
    balanceQueries.forEach(q => q.refetch());
  };

  return {
    tokens: tokensWithBalances,
    totalBalance,
    isLoading: tokensLoading || balancesLoading,
    error,
    refetch,
  };
}
