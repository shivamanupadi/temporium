import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback, useEffect, type ReactElement } from 'react';
import { motion } from 'framer-motion';
import { Gift, Loader2, RefreshCw, Coins } from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import { useTempo } from '@/hooks/useTempo';
import { useTokenList } from '@/hooks/useTokenList';
import { useFeePreference } from '@/hooks/useFeePreference';
import { useAllRewards, type TokenReward } from '@/hooks/useAllRewards';
import type { Token } from '@/lib/tokenlist';
import { tempoChain } from '@/lib/tempo-client';
import { formatAmount, cn } from '@/lib/utils';
import { getTokenColors } from '@/lib/tokenlist';

export const Route = createFileRoute('/portal/rewards')({
  component: RewardsPage,
});

function RewardsPage(): ReactElement | null {
  const { address, isConnected, claimRewards } = useTempo();
  const { tokens } = useTokenList();
  const { preferredFeeToken } = useFeePreference();
  const { rewards, isLoading, refresh } = useAllRewards();

  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [claimingToken, setClaimingToken] = useState<string | null>(null);

  useEffect(() => {
    if (tokens.length === 0 || feeToken) return;
    const preferred = preferredFeeToken
      ? tokens.find(t => t.address.toLowerCase() === preferredFeeToken.toLowerCase())
      : null;
    const chainDefault = tokens.find(
      t => t.address.toLowerCase() === tempoChain.feeToken.toLowerCase()
    );
    setFeeToken(preferred ?? chainDefault ?? tokens[0]);
  }, [tokens, feeToken, preferredFeeToken]);

  const handleClaim = useCallback(
    async (reward: TokenReward) => {
      if (!feeToken || claimingToken) return;
      setClaimingToken(reward.token.address);
      try {
        await claimRewards({
          token: reward.token.address,
          feeToken: feeToken.address,
        });
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
    [feeToken, claimingToken, claimRewards, refresh]
  );

  if (!isConnected || !address) return null;

  return (
    <div className="max-w-2xl">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">Rewards</h1>
          <p className="text-[14px] text-[#6B6560] mt-1">View and claim your token rewards</p>
        </div>
        <button
          onClick={refresh}
          className="p-2 rounded-xl border border-[#EDE9E3] text-[#9B9590] hover:text-[#6B6560] hover:bg-[#F5F2ED] transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
        </button>
      </div>

      {/* Fee token picker */}
      {feeToken && tokens.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl border border-[#EDE9E3] shadow-sm p-5 mb-4"
        >
          <FeeTokenPicker value={feeToken} tokens={tokens} onChange={setFeeToken} />
        </motion.div>
      )}

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
                    disabled={isClaiming || !feeToken}
                    onClick={() => handleClaim(reward)}
                    className="h-9 px-4 rounded-xl text-[13px] font-semibold bg-[#5B9A6F] hover:bg-[#4E8A62] text-white transition-all"
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
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl border border-[#EDE9E3] shadow-sm p-12 text-center"
        >
          <div className="w-14 h-14 rounded-full bg-[#F5F2ED] flex items-center justify-center mx-auto mb-4">
            <Coins className="w-6 h-6 text-[#B5B0AA]" />
          </div>
          <p className="text-[15px] font-semibold text-[#2D3436] mb-1">No Rewards Available</p>
          <p className="text-[13px] text-[#9B9590]">
            Rewards will appear here when you have claimable balances
          </p>
        </motion.div>
      )}
    </div>
  );
}
