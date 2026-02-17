import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback, type ReactElement } from 'react';
import { motion } from 'framer-motion';
import { Gift, Loader2, RefreshCw, Coins } from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { useTempo } from '@/hooks/useTempo';
import { useFeePreference } from '@/hooks/useFeePreference';
import { useAllRewards, type TokenReward } from '@/hooks/useAllRewards';
import { tempoChain, waitForTx } from '@/lib/tempo-client';
import { formatAmount } from '@/lib/utils';
import { getTokenColors } from '@/lib/tokenlist';

export const Route = createFileRoute('/portal/rewards')({
  component: RewardsPage,
});

function RewardsPage(): ReactElement | null {
  const { address, isConnected, claimRewards } = useTempo();
  const { preferredFeeToken } = useFeePreference();
  const { rewards, isLoading, refresh } = useAllRewards();

  const [claimingToken, setClaimingToken] = useState<string | null>(null);

  // Auto-resolve fee token from preference or chain default
  const feeTokenAddress = preferredFeeToken || tempoChain.feeToken;

  const handleClaim = useCallback(
    async (reward: TokenReward) => {
      if (claimingToken) return;
      setClaimingToken(reward.token.address);
      try {
        const hash = await claimRewards({
          token: reward.token.address,
          feeToken: feeTokenAddress,
        });
        await waitForTx(hash as `0x${string}`);
        toast.success(`Claimed ${reward.token.symbol} rewards`);
        refresh();
      } catch (err) {
        console.error('Claim failed:', err);
        const message = err instanceof Error ? err.message : 'Claim failed';
        toast.error(message);
      } finally {
        setClaimingToken(null);
      }
    },
    [feeTokenAddress, claimingToken, claimRewards, refresh]
  );

  if (!isConnected || !address) return null;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">TIP20 Rewards</h1>
          <p className="text-[14px] text-[#6B6560] mt-1">View and claim your token rewards</p>
        </div>
        <Button
          variant="outline"
          onClick={refresh}
          disabled={isLoading}
          className="h-10 px-5 rounded-xl text-[13px] font-medium border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isLoading ? 'Refreshing...' : 'Refresh'}</span>
        </Button>
      </motion.div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-[#EDE9E3] shadow-sm p-5 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#F5F2ED]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 bg-[#F5F2ED] rounded" />
                  <div className="h-3 w-16 bg-[#F5F2ED] rounded" />
                </div>
                <div className="h-9 w-20 bg-[#F5F2ED] rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rewards list */}
      {!isLoading && rewards.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="space-y-3"
        >
          {rewards.map(reward => {
            const colors = getTokenColors(reward.token.symbol);
            const isClaiming = claimingToken === reward.token.address;
            return (
              <motion.div
                key={reward.token.address}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-[#EDE9E3] shadow-sm p-5"
              >
                <div className="flex items-center gap-4">
                  {/* Token icon */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold shrink-0"
                    style={{ backgroundColor: colors.bg, color: colors.text }}
                  >
                    {reward.token.logoURI ? (
                      <img
                        src={reward.token.logoURI}
                        alt={reward.token.symbol}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      reward.token.symbol.slice(0, 2)
                    )}
                  </div>

                  {/* Token info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#2D3436]">
                      {reward.token.symbol}
                    </p>
                    <p className="text-[12px] text-[#9B9590]">{reward.token.name}</p>
                  </div>

                  {/* Claimable amount */}
                  <div className="text-right mr-3">
                    <p className="text-[15px] font-bold text-[#2D3436]">
                      {formatAmount(reward.rewardInfo.rewardBalance, reward.token.decimals, 4)}
                    </p>
                    <p className="text-[11px] text-[#9B9590] uppercase tracking-wider">Claimable</p>
                  </div>

                  {/* Claim button */}
                  <Button
                    disabled={isClaiming}
                    onClick={() => handleClaim(reward)}
                    className="h-9 px-4 rounded-xl text-[13px] font-semibold bg-sage hover:bg-sage/80 text-white transition-all"
                  >
                    {isClaiming ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Gift className="w-3.5 h-3.5 mr-1.5" />
                        Claim
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Empty state */}
      {!isLoading && rewards.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-dashed border-[#EDE9E3] bg-white p-12 text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-[#F5F2ED] flex items-center justify-center mx-auto mb-4">
            <Coins className="w-7 h-7 text-[#B5B0AA]" />
          </div>
          <h3 className="text-[16px] font-semibold text-[#2D3436]">No Rewards Available</h3>
          <p className="text-[13px] text-[#9B9590] mt-1.5 max-w-sm mx-auto leading-relaxed">
            Rewards will appear here when you have claimable token balances.
          </p>
        </motion.div>
      )}
    </div>
  );
}
