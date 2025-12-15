import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, Check, ExternalLink } from 'lucide-react';
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

interface BurnBlockedModalProps {
  isOpen: boolean;
  selectedCoin: StablecoinWithMetadata | null;
  onSuccess: () => void;
  onClose: () => void;
}

export function BurnBlockedModal({
  isOpen,
  selectedCoin,
  onSuccess,
  onClose,
}: BurnBlockedModalProps): ReactElement {
  const { burnBlocked } = useStablecoins();

  const [burnFrom, setBurnFrom] = useState('');
  const [amount, setAmount] = useState('');
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setBurnFrom('');
      setAmount('');
      setTxHash(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!selectedCoin || !burnFrom || !amount) {
      toast.error('Please fill in all fields');
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
      const result = await burnBlocked({
        token: selectedCoin.address,
        from: burnFrom as `0x${string}`,
        amount: parsedAmount,
        feeToken: feeToken?.address,
      });
      setTxHash(result.receipt.transactionHash);
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to burn blocked tokens';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [selectedCoin, burnFrom, amount, feeToken, burnBlocked, onSuccess]);

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
            {txHash ? 'Tokens Burned!' : `Burn Blocked - ${selectedCoin?.symbol}`}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Burn tokens from blocked address
          </DialogDescription>

          {txHash ? (
            <div className="text-center pt-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-6">
                <Check className="h-7 w-7 text-white" />
              </div>
              <p className="text-foreground text-sm font-semibold mb-1">Tokens Burned</p>
              <div className="mb-6">
                <span className="text-3xl font-semibold text-foreground">{amount}</span>
                <span className="text-lg text-muted-foreground ml-1.5">{selectedCoin?.symbol}</span>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 space-y-3 text-left mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Blocked Address</span>
                  <span className="font-mono text-xs text-foreground">
                    {burnFrom.slice(0, 10)}...{burnFrom.slice(-6)}
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
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-[12px] text-amber-700">
                    <span className="font-medium">Compliance Action:</span> Burn tokens from another
                    address that has been blocked. The target address must be on the blocklist.{' '}
                    <span className="font-medium">Requires Burn Blocked role.</span>
                  </p>
                </div>
                <AddressInput label="Blocked Address" value={burnFrom} onChange={setBurnFrom} />
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Amount to Burn
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
                  variant="destructive"
                  className="flex-1 h-10"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !burnFrom || !amount}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Burning
                    </>
                  ) : (
                    'Burn'
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
