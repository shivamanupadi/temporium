import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, ExternalLink, AlertTriangle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@temporium/shared-ui';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { useStablecoins } from '@/hooks/useStablecoins';
import { useTokenList } from '@/hooks/useTokenList';
import type { StablecoinWithMetadata } from '@/types';
import type { Token } from '@/lib/tokenlist';

interface PauseTokenModalProps {
  isOpen: boolean;
  mode: 'pause' | 'unpause';
  selectedCoin: StablecoinWithMetadata | null;
  onSuccess: () => void;
  onClose: () => void;
}

export function PauseTokenModal({
  isOpen,
  mode,
  selectedCoin,
  onSuccess,
  onClose,
}: PauseTokenModalProps): ReactElement {
  const { pauseToken, unpauseToken } = useStablecoins();
  const { tokens } = useTokenList();

  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [actionTaken, setActionTaken] = useState<'pause' | 'unpause' | null>(null);
  const isSubmittingRef = useRef(false);

  const isPause = mode === 'pause';
  const title = isPause ? 'Pause Token' : 'Unpause Token';
  const actionLabel = isPause ? 'Pause' : 'Unpause';

  useEffect(() => {
    if (isOpen) {
      setTxHash(null);
      setIsSubmitting(false);
      setFeeToken(tokens[0] ?? null);
      setActionTaken(null);
    }
  }, [isOpen, tokens]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!selectedCoin) return;

    setIsSubmitting(true);
    isSubmittingRef.current = true;
    try {
      const result = isPause
        ? await pauseToken({ token: selectedCoin.address, feeToken: feeToken?.address })
        : await unpauseToken({ token: selectedCoin.address, feeToken: feeToken?.address });

      setTxHash(result.receipt.transactionHash);
      setActionTaken(isPause ? 'pause' : 'unpause');
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to ${mode} token`;
      toast.error(message);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [selectedCoin, isPause, feeToken, pauseToken, unpauseToken, mode, onSuccess]);

  const handleClose = useCallback((): void => {
    if (!isSubmitting && !isSubmittingRef.current) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px] p-0 gap-0 rounded-2xl">
        {txHash ? (
          <>
            <DialogTitle className="sr-only">
              {actionTaken === 'pause' ? 'Token Paused!' : 'Token Unpaused!'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {actionTaken === 'pause'
                ? 'All transfers are now blocked'
                : 'Transfers are now enabled'}
            </DialogDescription>

            <div className="px-6 pt-10 pb-6 text-center">
              {/* Success icon */}
              <div className="inline-flex items-center justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-[var(--color-sage)] flex items-center justify-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-white">
                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              {/* Title */}
              <p className="text-[15px] font-bold text-[#2D3436] mb-1">
                {actionTaken === 'pause' ? 'Token Paused!' : 'Token Unpaused!'}
              </p>

              {/* Hero value */}
              <div className="mb-6">
                <span className="text-3xl font-bold text-[#2D3436]">{selectedCoin?.metadata?.name ?? selectedCoin?.symbol}</span>
                <span className="text-lg text-[#9B9590] ml-1.5 font-semibold">{selectedCoin?.symbol}</span>
              </div>

              {/* Details card */}
              <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3] space-y-3 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">Status</span>
                  <span className={`text-[12px] font-medium ${actionTaken === 'pause' ? 'text-[var(--color-coral)]' : 'text-[var(--color-sage)]'}`}>
                    {actionTaken === 'pause' ? 'Paused' : 'Active'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[#EDE9E3]">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">Transaction</span>
                  <span className="font-mono text-[12px] text-[#2D3436]">{txHash.slice(0, 10)}...{txHash.slice(-4)}</span>
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                onClick={() => window.open(getExplorerTxUrl(txHash), '_blank')}
                className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
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
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">{title}</DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                {isPause
                  ? `Pause all transfers of ${selectedCoin?.symbol}`
                  : `Resume all transfers of ${selectedCoin?.symbol}`}
              </DialogDescription>
            </div>
            <div className="px-6 pb-4">
              {isPause ? (
                <div className="space-y-3">
                  <div className="bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded-xl p-3">
                    <div className="flex gap-3">
                      <AlertTriangle className="h-5 w-5 text-[var(--color-warning)] flex-shrink-0 mt-0.5" />
                      <div className="text-[12px] text-[var(--color-warning)]">
                        <p className="font-medium mb-1">This will pause ALL token transfers</p>
                        <p>
                          When paused, no one can transfer, send, or receive {selectedCoin?.symbol}{' '}
                          tokens. This affects all holders, not just you.
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-[13px] font-light text-[#9B9590]">
                    <span className="text-[var(--color-warning)]">Requires Pause role.</span>
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-[#FDFBF8] rounded-xl p-3 border border-[#EDE9E3]">
                    <div className="flex gap-3">
                      <Check className="h-5 w-5 text-[var(--color-sage)] flex-shrink-0 mt-0.5" />
                      <div className="text-[12px] text-[var(--color-sage)]">
                        <p className="font-medium mb-1">This will resume ALL token transfers</p>
                        <p>
                          When unpaused, {selectedCoin?.symbol} tokens can be transferred normally
                          again.
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-[13px] font-light text-[#9B9590]">
                    <span className="text-[var(--color-warning)]">Requires Unpause role.</span>
                  </p>
                </div>
              )}
            </div>
            {feeToken && tokens.length > 0 && (
              <div className="px-6 pb-4">
                <FeeTokenPicker value={feeToken} tokens={tokens} onChange={setFeeToken} />
              </div>
            )}
            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              {isPause ? (
                <Button
                  className="flex-1 h-11 rounded-xl font-semibold bg-coral hover:bg-coral/80 text-white"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                  {isSubmitting ? 'Pausing...' : 'Pause'}
                </Button>
              ) : (
                <Button
                  className="flex-1 h-11 rounded-xl font-semibold bg-lavender hover:bg-lavender/80 text-white"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                  {isSubmitting ? 'Unpausing...' : 'Unpause'}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
