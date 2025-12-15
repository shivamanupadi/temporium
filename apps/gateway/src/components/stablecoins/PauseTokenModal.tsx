import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, Check, ExternalLink, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FeeTokenSelector } from '@/components/FeeTokenSelector';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { useStablecoins, type StablecoinWithMetadata } from '@/hooks/useStablecoins';
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
      setFeeToken(null);
      setActionTaken(null);
    }
  }, [isOpen]);

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
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
        <div className="p-5">
          <DialogTitle className="text-[15px] font-semibold mb-4">
            {txHash
              ? `Token ${actionTaken === 'pause' ? 'Paused' : 'Unpaused'}!`
              : `${title} - ${selectedCoin?.symbol}`}
          </DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>

          {txHash ? (
            <div className="text-center pt-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-6">
                <Check className="h-7 w-7 text-white" />
              </div>
              <p className="text-foreground text-sm font-semibold mb-1">
                Token {actionTaken === 'pause' ? 'Paused' : 'Unpaused'}
              </p>
              <p className="text-muted-foreground text-sm mb-6">
                {actionTaken === 'pause'
                  ? 'All transfers are now blocked'
                  : 'Transfers are now enabled'}
              </p>
              <div className="bg-muted/50 rounded-xl p-4 space-y-3 text-left mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Token</span>
                  <span className="text-xs font-medium text-foreground">
                    {selectedCoin?.symbol}
                  </span>
                </div>
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
              {isPause ? (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-[12px] text-amber-700">
                      <p className="font-medium mb-1">This will pause ALL token transfers</p>
                      <p>
                        When paused, no one can transfer, send, or receive {selectedCoin?.symbol}{' '}
                        tokens. This affects all holders, not just you.
                      </p>
                    </div>
                  </div>
                  <p className="text-[13px] text-muted-foreground">
                    Use this for emergencies or compliance requirements. You can unpause later to
                    restore normal operations.
                    <br />
                    <br />
                    <span className="text-amber-600">Requires Pause role.</span>
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex gap-3">
                    <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="text-[12px] text-green-700">
                      <p className="font-medium mb-1">This will resume ALL token transfers</p>
                      <p>
                        When unpaused, {selectedCoin?.symbol} tokens can be transferred normally
                        again. All holders will be able to send and receive tokens.
                      </p>
                    </div>
                  </div>
                  <p className="text-[13px] text-muted-foreground">
                    Make sure any issues that caused the pause have been resolved before unpausing.
                    <br />
                    <br />
                    <span className="text-amber-600">Requires Unpause role.</span>
                  </p>
                </div>
              )}

              <FeeTokenSelector
                value={feeToken}
                onChange={setFeeToken}
                className="pt-4 mt-4 border-t border-border"
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
                  className="flex-1 h-10"
                  variant={isPause ? 'destructive' : 'default'}
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isPause ? 'Pausing' : 'Unpausing'}
                    </>
                  ) : (
                    actionLabel
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
