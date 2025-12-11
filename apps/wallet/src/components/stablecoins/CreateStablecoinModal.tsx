import { useState, useEffect, useCallback, type ReactElement } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Lock, Check, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FeeTokenSelector } from '@/components/FeeTokenSelector';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { CURRENCIES } from '@/lib/constants';
import { useStablecoins } from '@/hooks/useStablecoins';
import type { Token } from '@/lib/tokenlist';

interface CreateStablecoinModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

export function CreateStablecoinModal({
  isOpen,
  onSuccess,
  onClose,
}: CreateStablecoinModalProps): ReactElement {
  const { createStablecoin } = useStablecoins();

  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setSymbol('');
      setCurrency('USD');
      setTxHash(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!name || !symbol) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createStablecoin({
        name,
        symbol,
        currency,
        feeToken: feeToken?.address,
      });

      setTxHash(result.receipt.transactionHash);
      toast.success('Stablecoin created!');
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create stablecoin';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [name, symbol, currency, feeToken, createStablecoin, onSuccess]);

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
            {txHash ? 'Stablecoin Created!' : 'Create Stablecoin'}
          </DialogTitle>
          <DialogDescription className="sr-only">Create a new stablecoin</DialogDescription>

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
                Your stablecoin has been created successfully
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
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Name
                  </label>
                  <Input
                    placeholder="My Stablecoin"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Symbol
                  </label>
                  <Input
                    placeholder="MYS"
                    value={symbol}
                    onChange={e => setSymbol(e.target.value.toUpperCase())}
                    className="h-10"
                    maxLength={6}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                      Currency
                    </label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map(curr => (
                          <SelectItem key={curr.value} value={curr.value}>
                            {curr.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      Decimals
                      <Lock className="h-3 w-3" />
                    </label>
                    <Input value="6" disabled className="h-10 bg-muted text-muted-foreground" />
                  </div>
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
                  disabled={isSubmitting || !name || !symbol}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
