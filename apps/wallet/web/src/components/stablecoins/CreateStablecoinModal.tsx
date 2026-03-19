import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, Lock, Plus } from 'lucide-react';
import { toast } from '@/lib/toast';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@temporium/shared-ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CURRENCIES } from '@/lib/constants';
import { useStablecoins } from '@/hooks/useStablecoins';
import { useTokenList } from '@/hooks/useTokenList';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
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
  const { tokens } = useTokenList();

  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [modalState, setModalState] = useState<ModalState>('form');
  const [isCreating, setIsCreating] = useState(false);
  const isCreatingRef = useRef(false);

  // Reset form only when modal opens (not when tokens refetch)
  useEffect(() => {
    if (isOpen) {
      setName('');
      setSymbol('');
      setCurrency('USD');
      setFeeToken(tokens[0] ?? null);
      setModalState('form');
      setIsCreating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <DialogContent className="sm:max-w-[400px] p-0 gap-0 rounded-2xl">
        {modalState === 'form' && (
          <>
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">
                Create TIP20 Token
              </DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                Configure your new stablecoin
              </DialogDescription>
            </div>

            <div className="px-6 pb-6">
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block">
                    Name
                  </label>
                  <input
                    type="text"
                    placeholder="My Token"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] text-[14px] text-[#2D3436] placeholder:text-[#B5B0AA] focus:border-coral/40 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block">
                    Symbol
                  </label>
                  <input
                    type="text"
                    placeholder="MYS"
                    value={symbol}
                    onChange={e => setSymbol(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="w-full px-4 py-3 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] text-[14px] text-[#2D3436] placeholder:text-[#B5B0AA] focus:border-coral/40 focus:outline-none transition-colors"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 flex items-center">
                      Currency
                    </label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger className="w-full !h-[46px] px-4 rounded-xl border-[#EDE9E3] bg-[#FDFBF8] text-[14px] text-[#2D3436] shadow-none focus:border-coral/40 transition-colors">
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
                    <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 flex items-center gap-1">
                      Decimals
                      <Lock className="h-3 w-3" />
                    </label>
                    <input
                      type="text"
                      value="6"
                      disabled
                      className="w-full h-[46px] px-4 rounded-xl border border-[#EDE9E3] bg-[#F5F2ED] text-[14px] text-[#9B9590] cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl font-semibold bg-coral hover:bg-coral/80 text-white"
                onClick={handleReview}
                disabled={!name || !symbol}
              >
                Review
              </Button>
            </div>
          </>
        )}

        {modalState === 'confirm' && (
          <>
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">Confirm Token</DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                Review the details before creating
              </DialogDescription>
            </div>

            <div className="px-6 pb-4 space-y-3">
              <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
                <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-1">
                  Token
                </p>
                <p className="text-lg font-bold text-[#2D3436]">
                  {name} <span className="text-[14px] font-semibold text-[#9B9590]">{symbol}</span>
                </p>
              </div>

              <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    Currency
                  </span>
                  <span className="text-[13px] font-medium text-[#2D3436]">{currency}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    Decimals
                  </span>
                  <span className="text-[13px] font-medium text-[#2D3436]">6</span>
                </div>
              </div>

              {feeToken && tokens.length > 0 && (
                <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#FDFBF8] border border-[#EDE9E3]">
                  <span className="text-[12px] text-[#9B9590]">Gas paid in</span>
                  <FeeTokenPicker value={feeToken} tokens={tokens} onChange={setFeeToken} />
                </div>
              )}
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                onClick={() => setModalState('form')}
                disabled={isCreating}
              >
                Back
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl font-semibold bg-coral hover:bg-coral/80 text-white"
                onClick={handleSubmit}
                disabled={isCreating}
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <Plus className="w-4 h-4 mr-1.5" />
                )}
                {isCreating ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
