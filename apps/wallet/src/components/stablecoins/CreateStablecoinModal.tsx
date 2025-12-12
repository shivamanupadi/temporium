import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, Lock, Coins } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
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
import { CURRENCIES } from '@/lib/constants';
import { useStablecoins } from '@/hooks/useStablecoins';
import type { Token } from '@/lib/tokenlist';

interface CreateStablecoinModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

type ModalState = 'form' | 'confirm';

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
  const [modalState, setModalState] = useState<ModalState>('form');
  const [isCreating, setIsCreating] = useState(false);
  const isCreatingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setSymbol('');
      setCurrency('USD');
      setModalState('form');
      setIsCreating(false);
    }
  }, [isOpen]);

  const handleReview = useCallback((): void => {
    if (!name || !symbol) {
      toast.error('Please fill in all fields');
      return;
    }
    setModalState('confirm');
  }, [name, symbol]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    setIsCreating(true);
    isCreatingRef.current = true;
    try {
      await createStablecoin({
        name,
        symbol,
        currency,
        feeToken: feeToken?.address,
      });

      // Fire confetti - gone in 3 seconds
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        ticks: 50,
        gravity: 3,
        decay: 0.9,
        scalar: 0.8,
      });

      toast.success(`${name} (${symbol}) created!`);
      onSuccess();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create token';
      toast.error(message);
    } finally {
      setIsCreating(false);
      isCreatingRef.current = false;
    }
  }, [name, symbol, currency, feeToken, createStablecoin, onSuccess, onClose]);

  const handleClose = useCallback((): void => {
    if (!isCreating && !isCreatingRef.current) {
      onClose();
    }
  }, [isCreating, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden rounded-2xl">
        {/* FORM STATE */}
        {modalState === 'form' && (
          <>
            <div className="px-6 pt-6 pb-4">
              <DialogTitle className="text-lg font-semibold">Create TIP20 Token</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Configure your new TIP20 token
              </DialogDescription>
            </div>

            <div className="px-6 pb-6">
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Name
                  </label>
                  <Input
                    placeholder="My Token"
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

                <FeeTokenSelector
                  value={feeToken}
                  onChange={setFeeToken}
                  className="pt-4 border-t border-border"
                />
              </div>

              <div className="flex gap-2 mt-6">
                <Button variant="outline" className="flex-1" onClick={onClose}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleReview} disabled={!name || !symbol}>
                  Review
                </Button>
              </div>
            </div>
          </>
        )}

        {/* CONFIRM STATE */}
        {modalState === 'confirm' && (
          <>
            <div className="px-6 pt-6 pb-4">
              <DialogTitle className="text-lg font-semibold">Confirm Creation</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Review the details before creating
              </DialogDescription>
            </div>

            <div className="px-6 pb-6">
              {/* Token Info Card */}
              <div className="bg-muted/50 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Coins className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Token</p>
                    <p className="text-lg font-semibold text-foreground">
                      {name} ({symbol})
                    </p>
                  </div>
                </div>
              </div>

              {/* Details Card */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Currency</span>
                  <span className="text-xs font-medium text-foreground">{currency}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Decimals</span>
                  <span className="text-xs font-medium text-foreground">6</span>
                </div>
                {feeToken && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Fee Token</span>
                    <span className="text-xs font-medium text-foreground">{feeToken.symbol}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setModalState('form')}
                disabled={isCreating}
              >
                Back
              </Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating
                  </>
                ) : (
                  'Create'
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
