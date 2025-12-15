import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, Check, ExternalLink, HandCoins } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FeeTokenSelector } from '@/components/FeeTokenSelector';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { formatAmount } from '@/lib/utils';
import { useRewards } from '@/hooks/useRewards';
import type { StablecoinWithMetadata } from '@/hooks/useStablecoins';
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

  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [claimedAmount, setClaimedAmount] = useState<string>('');
  const isSubmittingRef = useRef(false);

  const decimals = selectedCoin?.metadata?.decimals ?? 6;

  // Reset form when modal opens (not when claimableBalance changes)
  useEffect(() => {
    if (isOpen) {
      setTxHash(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

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
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
        <div className="p-5">
          <DialogTitle className="text-[15px] font-semibold mb-4">
            {txHash ? 'Rewards Claimed!' : 'Claim Rewards'}
          </DialogTitle>
          <DialogDescription className="sr-only">Claim your accumulated rewards</DialogDescription>

          {txHash ? (
            <div className="text-center pt-4">
              {/* Success icon */}
              <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-6">
                <Check className="h-7 w-7 text-white" />
              </div>

              {/* Success text */}
              <p className="text-foreground text-sm font-semibold mb-1">Rewards Claimed</p>

              {/* Amount */}
              <div className="mb-6">
                <span className="text-3xl font-semibold text-foreground">{claimedAmount}</span>
                <span className="text-lg text-muted-foreground ml-1.5">{selectedCoin?.symbol}</span>
              </div>

              {/* Details card */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-3 text-left mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Transaction</span>
                  <button
                    onClick={() => window.open(getExplorerTxUrl(txHash), '_blank')}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    <span className="font-mono">
                      {txHash.slice(0, 8)}...{txHash.slice(-4)}
                    </span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <Button className="w-full h-10" onClick={handleClose}>
                Done
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-xl mb-4">
                <HandCoins className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-muted-foreground">
                  Claim your accumulated reward balance. These tokens will be transferred to your
                  wallet.
                </p>
              </div>

              {/* Claimable Balance Display */}
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl p-4 mb-4">
                <p className="text-[11px] font-medium text-emerald-600 uppercase tracking-wider mb-1">
                  Claimable Balance
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-emerald-700">{formattedBalance}</span>
                  <span className="text-sm text-emerald-600">{selectedCoin?.symbol}</span>
                </div>
              </div>

              {claimableBalance <= 0n && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                  <p className="text-[12px] text-amber-700">
                    You don&apos;t have any rewards to claim at this time.
                  </p>
                </div>
              )}

              <FeeTokenSelector
                value={feeToken}
                onChange={setFeeToken}
                className="pt-4 border-t border-border"
              />

              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  className="flex-1 h-10"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleSubmit}
                  disabled={isSubmitting || claimableBalance <= 0n}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Claiming
                    </>
                  ) : (
                    'Claim Rewards'
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
