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

interface MintTokensModalProps {
  isOpen: boolean;
  selectedCoin: StablecoinWithMetadata | null;
  defaultMintTo?: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function MintTokensModal({
  isOpen,
  selectedCoin,
  defaultMintTo = '',
  onSuccess,
  onClose,
}: MintTokensModalProps): ReactElement {
  const { mintTokens } = useStablecoins();

  const [amount, setAmount] = useState('');
  const [mintTo, setMintTo] = useState(defaultMintTo);
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setMintTo(defaultMintTo);
      setTxHash(null);
      setIsSubmitting(false);
    }
  }, [isOpen, defaultMintTo]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!selectedCoin || !amount || !mintTo) {
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
      const result = await mintTokens({
        token: selectedCoin.address,
        to: mintTo as `0x${string}`,
        amount: parsedAmount,
        feeToken: feeToken?.address,
      });
      setTxHash(result.receipt.transactionHash);
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to mint tokens';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [selectedCoin, amount, mintTo, feeToken, mintTokens, onSuccess]);

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
            {txHash ? 'Tokens Minted!' : `Mint ${selectedCoin?.symbol}`}
          </DialogTitle>
          <DialogDescription className="sr-only">Mint new tokens</DialogDescription>

          {txHash ? (
            <div className="text-center pt-4">
              {/* Success icon */}
              <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-6">
                <Check className="h-7 w-7 text-white" />
              </div>

              {/* Success text */}
              <p className="text-foreground text-sm font-semibold mb-1">Tokens Minted</p>

              {/* Amount */}
              <div className="mb-6">
                <span className="text-3xl font-semibold text-foreground">{amount}</span>
                <span className="text-lg text-muted-foreground ml-1.5">{selectedCoin?.symbol}</span>
              </div>

              {/* Details card */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-3 text-left mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Recipient</span>
                  <span className="font-mono text-xs text-foreground">
                    {mintTo.slice(0, 10)}...{mintTo.slice(-6)}
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
              <p className="text-[13px] text-muted-foreground mb-4">
                Create new tokens and send them to a specified address. This increases the total
                supply. <span className="text-amber-600">Requires Issuer role.</span>
              </p>
              <div className="space-y-4">
                <AddressInput label="Recipient Address" value={mintTo} onChange={setMintTo} />
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
                  disabled={isSubmitting || !amount || !mintTo}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Minting
                    </>
                  ) : (
                    'Mint'
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
