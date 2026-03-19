import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@temporium/shared-ui';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { formatAmount, parseAmount } from '@/lib/utils';
import { useStablecoins } from '@/hooks/useStablecoins';
import { useTokenList } from '@/hooks/useTokenList';
import type { StablecoinWithMetadata } from '@/types';
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
  const { tokens } = useTokenList();

  const [supplyCapInput, setSupplyCapInput] = useState('');
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  const currentCap = selectedCoin?.metadata?.supplyCap;
  const decimals = selectedCoin?.metadata?.decimals ?? 6;

  useEffect(() => {
    if (isOpen) {
      setSupplyCapInput(currentCap ? formatAmount(currentCap.toString(), decimals) : '');
      setFeeToken(tokens[0] ?? null);
      setTxHash(null);
      setIsSubmitting(false);
    }
  }, [isOpen, currentCap, decimals, tokens]);

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
    isSubmittingRef.current = true;
    try {
      const result = await setSupplyCap({
        token: selectedCoin.address,
        supplyCap: parsedCap,
        feeToken: feeToken?.address,
      });
      setTxHash(result.receipt.transactionHash);
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set supply cap';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [selectedCoin, supplyCapInput, decimals, feeToken, setSupplyCap, onSuccess]);

  const handleClose = useCallback((): void => {
    if (!isSubmitting && !isSubmittingRef.current) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px] p-0 gap-0 rounded-2xl">
        {txHash ? (
          <>
            <DialogTitle className="sr-only">Supply Cap Updated!</DialogTitle>
            <DialogDescription className="sr-only">
              Transaction completed successfully
            </DialogDescription>

            <div className="px-6 pt-10 pb-6 text-center">
              {/* Success icon */}
              <div className="inline-flex items-center justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-[var(--color-sage)] flex items-center justify-center">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-white"
                  >
                    <path
                      d="M5 13l4 4L19 7"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              {/* Title */}
              <p className="text-[15px] font-bold text-[#2D3436] mb-1">Supply Cap Updated!</p>

              {/* Hero value */}
              <div className="mb-6">
                <span className="text-3xl font-bold text-[#2D3436]">{supplyCapInput}</span>
                <span className="text-lg text-[#9B9590] ml-1.5 font-semibold">
                  {selectedCoin?.symbol}
                </span>
              </div>

              {/* Details card */}
              <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3] text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    Transaction
                  </span>
                  <span className="font-mono text-[12px] text-[#2D3436]">
                    {txHash.slice(0, 10)}...{txHash.slice(-4)}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                onClick={() => window.open(getExplorerTxUrl(txHash), '_blank')}
                className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Explorer
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl font-semibold bg-[var(--color-sage)] hover:bg-[var(--color-sage)]/80 text-white"
                onClick={handleClose}
              >
                Done
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">Set Supply Cap</DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                Set the maximum total supply for this token
              </DialogDescription>
            </div>
            <div className="px-6 pb-4">
              <div className="space-y-3">
                {currentCap && (
                  <div className="bg-[#FDFBF8] rounded-xl p-3 border border-[#EDE9E3]">
                    <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-1">
                      Current Cap
                    </p>
                    <p className="text-[14px] font-medium text-[#2D3436]">
                      {formatAmount(currentCap.toString(), decimals)} {selectedCoin?.symbol}
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block">
                    New Supply Cap
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={supplyCapInput}
                    onChange={e => setSupplyCapInput(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] text-[14px] text-[#2D3436] placeholder:text-[#B5B0AA] focus:border-coral/40 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>
            {feeToken && tokens.length > 0 && (
              <div className="px-6 pb-4 flex items-center justify-between">
                <span className="text-[12px] text-[#9B9590]">Gas paid in</span>
                <FeeTokenPicker value={feeToken} tokens={tokens} onChange={setFeeToken} />
              </div>
            )}
            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl font-semibold bg-coral hover:bg-coral/80 text-white"
                onClick={handleSubmit}
                disabled={isSubmitting || !supplyCapInput}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                {isSubmitting ? 'Setting...' : 'Set Cap'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
