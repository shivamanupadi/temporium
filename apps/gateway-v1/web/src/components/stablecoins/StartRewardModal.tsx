import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, ExternalLink, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@temporium/shared-ui';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { parseAmount, formatAmount } from '@/lib/utils';
import { useRewards } from '@/hooks/useRewards';
import { useTokenList } from '@/hooks/useTokenList';
import type { StablecoinWithMetadata } from '@/types';
import type { Token } from '@/lib/tokenlist';

interface StartRewardModalProps {
  isOpen: boolean;
  selectedCoin: StablecoinWithMetadata | null;
  onSuccess: () => void;
  onClose: () => void;
}

export function StartRewardModal({
  isOpen,
  selectedCoin,
  onSuccess,
  onClose,
}: StartRewardModalProps): ReactElement {
  const { startReward } = useRewards({ token: selectedCoin?.address });
  const { tokens } = useTokenList();

  const [amount, setAmount] = useState('');
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setFeeToken(tokens[0] ?? null);
      setTxHash(null);
      setIsSubmitting(false);
    }
  }, [isOpen, tokens]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!selectedCoin || !amount) {
      toast.error('Please enter an amount');
      return;
    }

    const parsedAmount = parseAmount(amount, selectedCoin.metadata?.decimals ?? 6);
    if (parsedAmount <= 0n) {
      toast.error('Invalid amount');
      return;
    }

    setIsSubmitting(true);
    isSubmittingRef.current = true;
    try {
      const result = await startReward({
        amount: parsedAmount,
        feeToken: feeToken?.address,
      });
      setTxHash(result.receipt.transactionHash);
      onSuccess();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to start reward distribution';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [selectedCoin, amount, feeToken, startReward, onSuccess]);

  const handleClose = useCallback((): void => {
    if (!isSubmitting && !isSubmittingRef.current) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  const decimals = selectedCoin?.metadata?.decimals ?? 6;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px] p-0 gap-0 rounded-2xl">
        {txHash ? (
          <>
            <DialogTitle className="sr-only">Rewards Distributed!</DialogTitle>
            <DialogDescription className="sr-only">
              Your reward distribution has been completed
            </DialogDescription>

            <div className="px-6 pt-10 pb-6 text-center">
              {/* Sage checkmark */}
              <div className="w-16 h-16 rounded-full bg-[var(--color-sage)] flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              {/* Title */}
              <h3 className="text-[15px] font-bold text-[#2D3436] mb-1">Rewards Distributed!</h3>

              {/* Hero value */}
              <div className="mb-6">
                <span className="text-3xl font-bold text-[#2D3436]">{amount}</span>
                <span className="text-lg text-[#9B9590] ml-1.5 font-semibold">{selectedCoin?.symbol}</span>
              </div>

              {/* Details card */}
              <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3] space-y-3 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    Distribution
                  </span>
                  <span className="text-[13px] text-[#2D3436]">Immediate</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[#EDE9E3]">
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
                Distribute Rewards
              </DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590] mt-1">
                Distribute rewards to token holders
              </DialogDescription>
            </div>

            {/* Form body */}
            <div className="px-6 pb-4 space-y-3">
              {/* Info banner */}
              <div className="flex items-start gap-3 p-3 bg-[var(--color-sage)]/10 border border-[var(--color-sage)]/30 rounded-xl">
                <Gift className="h-5 w-5 text-[var(--color-sage)] flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-[#9B9590]">
                  Distribute rewards instantly to all opted-in token holders. The amount will be
                  split proportionally based on each holder&apos;s balance.
                </p>
              </div>

              {/* Amount input */}
              <div>
                <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block">
                  Amount to Distribute
                </label>
                <input
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  type="text"
                  inputMode="decimal"
                  className="w-full px-4 py-3 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] text-[14px] text-[#2D3436] placeholder:text-[#B5B0AA] focus:border-sage/40 focus:outline-none transition-colors"
                />
                <p className="text-[11px] text-[#9B9590] mt-1">
                  Your balance:{' '}
                  {selectedCoin?.userBalance !== undefined
                    ? formatAmount(selectedCoin.userBalance.toString(), decimals)
                    : '—'}{' '}
                  {selectedCoin?.symbol}
                </p>
              </div>
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
                disabled={isSubmitting || !amount}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    Distributing
                  </>
                ) : (
                  'Distribute'
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
