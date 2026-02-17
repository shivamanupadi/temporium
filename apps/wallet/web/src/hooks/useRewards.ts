import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWalletClient, useAccount } from 'wagmi';
import { Actions, tempoPublicClient } from '@/lib/tempo-client';
import { DEFAULT_FEE_TOKEN_ADDRESS } from '@/lib/constants';
import type { Address } from 'viem';

export const REWARDS_QUERY_KEY = 'rewards';

export interface RewardInfo {
  rewardRecipient: Address;
  rewardPerToken: bigint;
  rewardBalance: bigint;
  isOptedIn: boolean;
}

interface UseRewardsParams {
  token: Address | undefined;
}

interface UseRewardsReturn {
  rewardInfo: RewardInfo | null;
  isLoading: boolean;
  startReward: (params: {
    amount: bigint;
    feeToken?: Address;
  }) => Promise<{ receipt: { transactionHash: string } }>;
  setRecipient: (params: {
    recipient: Address;
    feeToken?: Address;
  }) => Promise<{ receipt: { transactionHash: string } }>;
  claimRewards: (params: {
    feeToken?: Address;
  }) => Promise<{ receipt: { transactionHash: string } }>;
  refresh: () => Promise<void>;
}

export function useRewards({ token }: UseRewardsParams): UseRewardsReturn {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const queryClient = useQueryClient();

  const { data: rewardInfo = null, isLoading } = useQuery({
    queryKey: [REWARDS_QUERY_KEY, token, address],
    queryFn: async (): Promise<RewardInfo | null> => {
      if (!token || !address) return null;

      try {
        const info = await Actions.reward.getUserRewardInfo(tempoPublicClient, {
          token,
          account: address,
        });

        const zeroAddress = '0x0000000000000000000000000000000000000000' as Address;
        const isOptedIn = info.rewardRecipient.toLowerCase() !== zeroAddress.toLowerCase();

        return {
          rewardRecipient: info.rewardRecipient,
          rewardPerToken: info.rewardPerToken,
          rewardBalance: info.rewardBalance,
          isOptedIn,
        };
      } catch (err) {
        console.error('Failed to fetch reward info:', err);
        return null;
      }
    },
    enabled: !!token && !!address,
    staleTime: 10000,
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: [REWARDS_QUERY_KEY, token, address] });
  }, [queryClient, token, address]);

  const startReward = useCallback(
    async (params: { amount: bigint; feeToken?: Address }) => {
      if (!walletClient || !token) throw new Error('Wallet not connected');

      const result = await Actions.reward.distributeSync(walletClient, {
        token,
        amount: params.amount,
        feeToken: params.feeToken ?? DEFAULT_FEE_TOKEN_ADDRESS,
      });

      await refresh();
      return result;
    },
    [walletClient, token, refresh]
  );

  const setRecipient = useCallback(
    async (params: { recipient: Address; feeToken?: Address }) => {
      if (!walletClient || !token) throw new Error('Wallet not connected');

      const result = await Actions.reward.setRecipientSync(walletClient, {
        token,
        recipient: params.recipient,
        feeToken: params.feeToken ?? DEFAULT_FEE_TOKEN_ADDRESS,
      });

      await refresh();
      return result;
    },
    [walletClient, token, refresh]
  );

  const claimRewards = useCallback(
    async (params: { feeToken?: Address }) => {
      if (!walletClient || !token) throw new Error('Wallet not connected');

      const result = await Actions.reward.claimSync(walletClient, {
        token,
        feeToken: params.feeToken ?? DEFAULT_FEE_TOKEN_ADDRESS,
      });

      await refresh();
      return result;
    },
    [walletClient, token, refresh]
  );

  return {
    rewardInfo,
    isLoading,
    startReward,
    setRecipient,
    claimRewards,
    refresh,
  };
}
