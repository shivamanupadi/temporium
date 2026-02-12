import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, ExternalLink, HandCoins } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@temporium/shared-ui';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { formatAmount } from '@/lib/utils';
import { useRewards } from '@/hooks/useRewards';
import { useTokenList } from '@/hooks/useTokenList';
import type { StablecoinWithMetadata } from '@/types';
import type { Token } from '@/lib/tokenlist';

interface ClaimRewardsModalProps {
  isOpen: boolean;
  selectedCoin: StablecoinWithMetadata | null;
  claimableBalance: bigint;
  onSuccess: () => void;
  onClose: () => void;
}

export function ClaimRewardsModal({
  isOpen,
  selectedCoin,
  claimableBalance,
  onSuccess,
  onClose,
}: ClaimRewardsModalProps): ReactElement {
  const { claimRewards } = useRewards({ token: selectedCoin?.address });
  const { tokens } = useTokenList();

  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [claimedAmount, setClaimedAmount] = useState<string>('');
  const isSubmittingRef = useRef(false);

  const decimals = selectedCoin?.metadata?.decimals ?? 6;

  // Reset form when modal opens (not when claimableBalance changes)
  useEffect(() => {
    if (isOpen) {
      setFeeToken(tokens[0] ?? null);
      setTxHash(null);
      setIsSubmitting(false);
    }
  }, [isOpen, tokens]);

  // Store the claimable amount when modal opens
  useEffect(() => {
    if (isOpen && !txHash) {
      setClaimedAmount(formatAmount(claimableBalance.toString(), decimals));
    }
  }, [isOpen, claimableBalance, decimals, txHash]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!selectedCoin) {
      toast.error('No token selected');
      return;
    }

    if (claimableBalance <= 0n) {
      toast.error('No rewards to claim');
      return;
    }

    setIsSubmitting(true);
    isSubmittingRef.current = true;
    try {
      const result = await claimRewards({
        feeToken: feeToken?.address,
      });
      setTxHash(result.receipt.transactionHash);
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to claim rewards';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [selectedCoin, claimableBalance, feeToken, claimRewards, onSuccess]);

  const handleClose = useCallback((): void => {
    if (!isSubmitting && !isSubmittingRef.current) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  const formattedBalance = formatAmount(claimableBalance.toString(), decimals);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px] p-0 gap-0 rounded-2xl">
        {txHash ? (
          <>
            <DialogTitle className="sr-only">Rewards Claimed!</DialogTitle>
            <DialogDescription className="sr-only">
              Your rewards have been transferred to your wallet
            </DialogDescription>

            <div className="px-6 pt-10 pb-6 text-center">
              {/* Sage checkmark */}
              <div className="w-16 h-16 rounded-full bg-[var(--color-sage)] flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              {/* Title */}
              <h3 className="text-[15px] font-bold text-[#2D3436] mb-1">Rewards Claimed!</h3>

              {/* Hero value */}
              <div className="mb-6">
                <span className="text-3xl font-bold text-[#2D3436]">{claimedAmount}</span>
                <span className="text-lg text-[#9B9590] ml-1.5 font-semibold">{selectedCoin?.symbol}</span>
              </div>

              {/* Details card */}
              <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3] space-y-3 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    Transaction
                  </span>
                  <button
                    onClick={() => window.open(getExplorerTxUrl(txHash), '_blank')}
                    className="flex items-center gap-1 text-[13px] text-sage hover:text-sage/80 transition-colors"
                  >
                    <span className="font-mono">
                      {txHash.slice(0, 8)}...{txHash.slice(-4)}
                    </span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Two-button footer */}
            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                onClick={() => window.open(getExplorerTxUrl(txHash), '_blank')}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Explorer
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl font-semibold bg-[var(--color-sage)] hover:bg-[var(--color-sage)]/80 text-white"
                onClick={handleClose}
              >
                Done
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">
                Claim Rewards
              </DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590] mt-1">
                Claim your accumulated rewards
              </DialogDescription>
            </div>

            {/* Form body */}
            <div className="px-6 pb-4 space-y-3">
              {/* Info banner */}
              <div className="flex items-start gap-3 p-3 bg-[var(--color-sage)]/10 border border-[var(--color-sage)]/30 rounded-xl">
                <HandCoins className="h-5 w-5 text-[var(--color-sage)] flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-[#9B9590]">
                  Claim your accumulated reward balance. These tokens will be transferred to your
                  wallet.
                </p>
              </div>

              {/* Claimable Balance Display */}
              <div className="bg-gradient-to-br from-[var(--color-sage)]/10 to-[var(--color-sage)]/15 rounded-xl p-4 border border-[#EDE9E3]">
                <p className="text-[11px] font-semibold text-[var(--color-sage)] uppercase tracking-wider mb-1">
                  Claimable Balance
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[var(--color-sage)]">{formattedBalance}</span>
                  <span className="text-sm text-[var(--color-sage)]">{selectedCoin?.symbol}</span>
                </div>
              </div>

              {/* Zero balance warning */}
              {claimableBalance <= 0n && (
                <div className="bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded-xl p-3">
                  <p className="text-[12px] text-[var(--color-warning)]">
                    You don&apos;t have any rewards to claim at this time.
                  </p>
                </div>
              )}
            </div>

            {/* Fee token picker */}
            {feeToken && tokens.length > 0 && (
              <div className="px-6 pb-4">
                <FeeTokenPicker value={feeToken} tokens={tokens} onChange={setFeeToken} />
              </div>
            )}

            {/* Buttons */}
            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl font-semibold bg-[var(--color-sage)] hover:bg-[var(--color-sage)]/80 text-white"
                onClick={handleSubmit}
                disabled={isSubmitting || claimableBalance <= 0n}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    Claiming
                  </>
                ) : (
                  'Claim Rewards'
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
