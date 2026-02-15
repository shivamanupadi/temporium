import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAccount, useWalletClient } from 'wagmi';
import type { Address } from 'viem';
import { Actions, tempoPublicClient, waitForTx } from '@/lib/tempo-client';

interface UseFeePreferenceReturn {
  preferredFeeToken: Address | null;
  isLoading: boolean;
  setFeePreference: (tokenAddress: Address) => Promise<string>;
  isSetting: boolean;
}

export function useFeePreference(): UseFeePreferenceReturn {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const queryClient = useQueryClient();

  const { data: preferredFeeToken = null, isLoading } = useQuery({
    queryKey: ['feePreference', address],
    queryFn: async (): Promise<Address | null> => {
      if (!address) return null;
      try {
        const result = await Actions.fee.getUserToken(tempoPublicClient, { account: address });
        if (!result || result.address === '0x0000000000000000000000000000000000000000') return null;
        return result.address as Address;
      } catch {
        return null;
      }
    },
    enabled: !!address,
    staleTime: 30_000,
  });

  const setFeePreference = useCallback(
    async (tokenAddress: Address): Promise<string> => {
      if (!walletClient) throw new Error('Wallet not connected');
      const hash = await Actions.fee.setUserToken(walletClient, { token: tokenAddress });
      await waitForTx(hash);
      await queryClient.invalidateQueries({ queryKey: ['feePreference', address] });
      return hash;
    },
    [walletClient, queryClient, address]
  );

  const isSetting = false; // Managed externally via mutation state if needed

  return { preferredFeeToken, isLoading, setFeePreference, isSetting };
}
