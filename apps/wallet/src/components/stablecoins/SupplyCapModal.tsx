import { useState, useEffect, useCallback, type ReactElement } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Check, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DecimalInput } from '@/components/DecimalInput';
import { FeeTokenSelector } from '@/components/FeeTokenSelector';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { formatAmount, parseAmount } from '@/lib/utils';
import { useStablecoins, type StablecoinWithMetadata } from '@/hooks/useStablecoins';
import type { Token } from '@/lib/tokenlist';

interface SupplyCapModalProps {
  isOpen: boolean;
  selectedCoin: StablecoinWithMetadata | null;
  onSuccess: () => void;
  onClose: () => void;
}

export function SupplyCapModal({
  isOpen,
  selectedCoin,
  onSuccess,
  onClose,
}: SupplyCapModalProps): ReactElement {
  const { setSupplyCap } = useStablecoins();

  const [supplyCapInput, setSupplyCapInput] = useState('');
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const currentCap = selectedCoin?.metadata?.supplyCap;
  const decimals = selectedCoin?.metadata?.decimals ?? 6;

  useEffect(() => {
    if (isOpen) {
      setSupplyCapInput(currentCap ? formatAmount(currentCap.toString(), decimals) : '');
      setTxHash(null);
      setIsSubmitting(false);
    }
  }, [isOpen, currentCap, decimals]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!selectedCoin || !supplyCapInput) {
      toast.error('Please enter a supply cap');
      return;
    }

    const parsedCap = parseAmount(supplyCapInput, decimals);
    if (parsedCap <= 0n) {
      toast.error('Invalid supply cap');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await setSupplyCap({
        token: selectedCoin.address,
        supplyCap: parsedCap,
        feeToken: feeToken?.address,
      });
      setTxHash(result.receipt.transactionHash);
      toast.success('Supply cap updated!');
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set supply cap';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedCoin, supplyCapInput, decimals, feeToken, setSupplyCap, onSuccess]);

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
            {txHash ? 'Supply Cap Updated!' : `Set Supply Cap - ${selectedCoin?.symbol}`}
          </DialogTitle>
          <DialogDescription className="sr-only">Set maximum supply cap</DialogDescription>

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
                Supply cap set to {supplyCapInput} {selectedCoin?.symbol}
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
              <p className="text-[13px] text-muted-foreground mb-4">
                Set the maximum total supply that can ever exist for this token. Once set, minting
                will be blocked if it would exceed this cap.
                <br />
                <br />
                <span className="text-amber-600">Requires Admin role.</span>
              </p>
              <div className="space-y-4">
                {currentCap && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      Current Cap
                    </p>
                    <p className="text-[14px] font-medium text-foreground">
                      {formatAmount(currentCap.toString(), decimals)} {selectedCoin?.symbol}
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    New Supply Cap
                  </label>
                  <DecimalInput value={supplyCapInput} onChange={setSupplyCapInput} />
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
                  disabled={isSubmitting || !supplyCapInput}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Set Cap'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
