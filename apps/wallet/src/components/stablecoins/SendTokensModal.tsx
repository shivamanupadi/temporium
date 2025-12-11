import { useState, useEffect, useCallback, type ReactElement } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Check, ExternalLink, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DecimalInput } from '@/components/DecimalInput';
import { AddressInput } from '@/components/AddressInput';
import { FeeTokenSelector } from '@/components/FeeTokenSelector';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { parseAmount } from '@/lib/utils';
import { useStablecoins, type StablecoinWithMetadata } from '@/hooks/useStablecoins';
import type { Token } from '@/lib/tokenlist';

interface SendTokensModalProps {
  isOpen: boolean;
  selectedCoin: StablecoinWithMetadata | null;
  onSuccess: () => void;
  onClose: () => void;
}

export function SendTokensModal({
  isOpen,
  selectedCoin,
  onSuccess,
  onClose,
}: SendTokensModalProps): ReactElement {
  const { sendTokens } = useStablecoins();

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRecipient('');
      setAmount('');
      setFeeToken(null);
      setTxHash(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!selectedCoin || !recipient || !amount) {
      toast.error('Please fill in all fields');
      return;
    }

    const parsedAmount = parseAmount(amount, selectedCoin.metadata?.decimals ?? 6);
    if (parsedAmount <= 0n) {
      toast.error('Invalid amount');
      return;
    }

    // Check if user has enough balance
    if (selectedCoin.userBalance !== undefined && parsedAmount > selectedCoin.userBalance) {
      toast.error('Insufficient balance');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await sendTokens({
        token: selectedCoin.address,
        to: recipient as `0x${string}`,
        amount: parsedAmount,
        feeToken: feeToken?.address,
      });
      setTxHash(result.transactionHash);
      toast.success('Tokens sent!');
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send tokens';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedCoin, recipient, amount, feeToken, sendTokens, onSuccess]);

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
            {txHash ? 'Tokens Sent!' : `Send ${selectedCoin?.symbol}`}
          </DialogTitle>
          <DialogDescription className="sr-only">Send tokens to another address</DialogDescription>

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
                Successfully sent {amount} {selectedCoin?.symbol}
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
              {selectedCoin?.metadata?.paused ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-3 mb-4">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-[12px] text-amber-700">
                    <p className="font-medium mb-1">Transfers are paused</p>
                    <p>
                      {selectedCoin.symbol} transfers are currently paused. You cannot send tokens
                      until the token is unpaused.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-muted-foreground mb-4">
                  Transfer tokens from{' '}
                  <span className="font-medium text-foreground">your wallet</span> to another
                  address. The recipient will receive the tokens immediately.
                </p>
              )}
              <div className="space-y-4">
                <AddressInput label="Recipient Address" value={recipient} onChange={setRecipient} />
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Amount
                  </label>
                  <DecimalInput value={amount} onChange={setAmount} />
                </div>
              </div>

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
                  onClick={handleSubmit}
                  disabled={isSubmitting || !recipient || !amount || selectedCoin?.metadata?.paused}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
