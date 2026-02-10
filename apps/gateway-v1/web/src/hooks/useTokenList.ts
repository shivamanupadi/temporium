import { useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import type { Address } from 'viem';
import { getTokens, type Token } from '@/lib/tokenlist';
import { getTokenBalance } from '@/lib/tempo-client';
import { TIMING } from '@/lib/constants';

interface UseTokenListReturn {
  tokens: Token[];
  isLoading: boolean;
  error: Error | null;
}

export function useTokenList(): UseTokenListReturn {
  const {
    data: tokens = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['tokenlist'],
    queryFn: getTokens,
    staleTime: 5 * 60 * 1000,
  });

  return { tokens, isLoading, error: error as Error | null };
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

export function useTokensWithBalances(account?: Address): UseTokensWithBalancesReturn {
  const { tokens, isLoading: tokensLoading, error } = useTokenList();

  const balanceQueries = useQueries({
    queries: tokens.map(token => ({
      queryKey: ['tokenBalance', token.address, account],
      queryFn: () => getTokenBalance(token.address, account!),
      enabled: !!account && tokens.length > 0,
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
