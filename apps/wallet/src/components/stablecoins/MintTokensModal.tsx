import { useState, useEffect, useCallback, type ReactElement } from 'react';
import { motion } from 'framer-motion';
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
    try {
      const result = await mintTokens({
        token: selectedCoin.address,
        to: mintTo as `0x${string}`,
        amount: parsedAmount,
        feeToken: feeToken?.address,
      });
      setTxHash(result.receipt.transactionHash);
      toast.success('Tokens minted!');
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to mint tokens';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedCoin, amount, mintTo, feeToken, mintTokens, onSuccess]);

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
            {txHash ? 'Tokens Minted!' : `Mint ${selectedCoin?.symbol}`}
          </DialogTitle>
          <DialogDescription className="sr-only">Mint new tokens</DialogDescription>

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
                Successfully minted {amount} {selectedCoin?.symbol}
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
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Mint'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
