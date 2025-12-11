import { useState, useEffect, useCallback, type ReactElement } from 'react';
import { motion } from 'framer-motion';
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

  const isPause = mode === 'pause';
  const title = isPause ? 'Pause Token' : 'Unpause Token';
  const actionLabel = isPause ? 'Pause' : 'Unpause';

  useEffect(() => {
    if (isOpen) {
      setTxHash(null);
      setIsSubmitting(false);
      setFeeToken(null);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!selectedCoin) return;

    setIsSubmitting(true);
    try {
      const result = isPause
        ? await pauseToken({ token: selectedCoin.address, feeToken: feeToken?.address })
        : await unpauseToken({ token: selectedCoin.address, feeToken: feeToken?.address });

      setTxHash(result.receipt.transactionHash);
      toast.success(isPause ? 'Token paused!' : 'Token unpaused!');
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to ${mode} token`;
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedCoin, isPause, feeToken, pauseToken, unpauseToken, mode, onSuccess]);

  const handleClose = useCallback((): void => {
    if (!isSubmitting) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
        <div className="p-5">
          <DialogTitle className="text-[15px] font-semibold mb-4">
            {txHash
              ? `Token ${isPause ? 'Paused' : 'Unpaused'}!`
              : `${title} - ${selectedCoin?.symbol}`}
          </DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>

          {txHash ? (
            <div className="text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4"
              >
                <Check className="h-6 w-6 text-success" />
              </motion.div>
              <p className="text-[13px] text-muted-foreground mb-4">
                {isPause
                  ? `${selectedCoin?.symbol} has been paused. All transfers are now blocked.`
                  : `${selectedCoin?.symbol} has been unpaused. Transfers are now enabled.`}
              </p>
              <div className="flex gap-2">
                <a
                  href={getExplorerTxUrl(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg border border-border text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Explorer <ExternalLink className="h-3 w-3" />
                </a>
                <Button className="flex-1 h-10" onClick={handleClose}>
                  Done
                </Button>
              </div>
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
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : actionLabel}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
