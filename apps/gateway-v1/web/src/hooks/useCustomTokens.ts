import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { apiGet, apiPost, apiDelete } from '@/lib/api-client';
import type { Token } from '@/lib/tokenlist';

export const CUSTOM_TOKENS_QUERY_KEY = 'customTokens';

interface CustomTokenRecord {
  id: string;
  owner: string;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string | null;
  createdAt: string;
}

interface AddCustomTokenParams {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
}

interface UseCustomTokensReturn {
  customTokens: CustomTokenRecord[];
  asTokenList: Token[];
  isLoading: boolean;
  addToken: (params: AddCustomTokenParams) => Promise<void>;
  removeToken: (id: string) => Promise<void>;
}

export function useCustomTokens(): UseCustomTokensReturn {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();

  const { data: customTokens = [], isLoading } = useQuery({
    queryKey: [CUSTOM_TOKENS_QUERY_KEY, address],
    queryFn: () => apiGet<CustomTokenRecord[]>('/v1/custom-tokens'),
    enabled: isConnected && !!address,
    staleTime: 30_000,
  });

  // Convert D1 records to Token format for use in token lists
  const asTokenList: Token[] = customTokens.map(ct => ({
    name: ct.name,
    symbol: ct.symbol,
    decimals: ct.decimals,
    chainId: 0, // Will be filled by useTokenList merger
    address: ct.address as `0x${string}`,
    logoURI: ct.logoURI || '',
  }));

  const addToken = useCallback(
    async (params: AddCustomTokenParams) => {
      await apiPost('/v1/custom-tokens', params);
      await queryClient.invalidateQueries({ queryKey: [CUSTOM_TOKENS_QUERY_KEY, address] });
      await queryClient.invalidateQueries({ queryKey: ['tokenlist'] });
    },
    [queryClient, address]
  );

  const removeToken = useCallback(
    async (id: string) => {
      await apiDelete(`/v1/custom-tokens/${id}`);
      await queryClient.invalidateQueries({ queryKey: [CUSTOM_TOKENS_QUERY_KEY, address] });
      await queryClient.invalidateQueries({ queryKey: ['tokenlist'] });
    },
    [queryClient, address]
  );

  return { customTokens, asTokenList, isLoading, addToken, removeToken };
}
