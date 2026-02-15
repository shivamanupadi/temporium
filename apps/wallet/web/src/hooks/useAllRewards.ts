import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import type { Address } from 'viem';
import { useAccount } from 'wagmi';
import { Actions, tempoPublicClient } from '@/lib/tempo-client';
import { useTokenList } from '@/hooks/useTokenList';
import type { Token } from '@/lib/tokenlist';
import { TIMING } from '@/lib/constants';

export interface RewardInfo {
  rewardRecipient: Address;
  rewardPerToken: bigint;
  rewardBalance: bigint;
}

export interface TokenReward {
  token: Token;
  rewardInfo: RewardInfo;
}

interface UseAllRewardsReturn {
  rewards: TokenReward[];
  isLoading: boolean;
  refresh: () => void;
}

export function useAllRewards(): UseAllRewardsReturn {
  const { address } = useAccount();
  const { tokens, isLoading: tokensLoading } = useTokenList();

  const rewardQueries = useQueries({
    queries: tokens.map(token => ({
      queryKey: ['rewardInfo', token.address, address],
      queryFn: async (): Promise<{ token: Token; rewardInfo: RewardInfo } | null> => {
        if (!address) return null;
        try {
          const info = await Actions.reward.getUserRewardInfo(tempoPublicClient, {
            token: token.address,
            account: address,
          });
          return {
            token,
            rewardInfo: {
              rewardRecipient: info.rewardRecipient as Address,
              rewardPerToken: info.rewardPerToken as bigint,
              rewardBalance: info.rewardBalance as bigint,
            },
          };
        } catch {
          return null;
        }
      },
      enabled: !!address && tokens.length > 0,
      refetchInterval: TIMING.BALANCE_REFRESH_MS,
      staleTime: 10_000,
    })),
  });

  const isLoading = tokensLoading || rewardQueries.some(q => q.isLoading);

  const rewards = useMemo((): TokenReward[] => {
    return rewardQueries
      .map(q => q.data)
      .filter(
        (d): d is TokenReward => d !== null && d !== undefined && d.rewardInfo.rewardBalance > 0n
      );
  }, [rewardQueries]);

  const refresh = (): void => {
    rewardQueries.forEach(q => q.refetch());
  };

  return { rewards, isLoading, refresh };
}
