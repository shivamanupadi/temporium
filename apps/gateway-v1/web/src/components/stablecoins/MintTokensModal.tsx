import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@temporium/shared-ui';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import { ContactPicker } from '@/components/ContactPicker';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { parseAmount } from '@/lib/utils';
import { useStablecoins } from '@/hooks/useStablecoins';
import { useTokenList } from '@/hooks/useTokenList';
import type { StablecoinWithMetadata } from '@/types';
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
  const { tokens } = useTokenList();

  const [amount, setAmount] = useState('');
  const [mintTo, setMintTo] = useState(defaultMintTo);
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setMintTo(defaultMintTo);
      setFeeToken(tokens[0] ?? null);
      setTxHash(null);
      setIsSubmitting(false);
    }
  }, [isOpen, defaultMintTo, tokens]);

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
      <DialogContent className="sm:max-w-[400px] p-0 gap-0 rounded-2xl">
        {txHash ? (
          <>
            <DialogTitle className="sr-only">Tokens Minted!</DialogTitle>
            <DialogDescription className="sr-only">Transaction completed successfully</DialogDescription>
            <div className="px-6 pt-10 pb-6 text-center">
              <div className="w-16 h-16 rounded-full bg-[var(--color-sage)] flex items-center justify-center mx-auto mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              </div>
              <h3 className="text-[15px] font-bold text-[#2D3436] mb-1">Tokens Minted!</h3>
              <div className="mb-6">
                <span className="text-3xl font-bold text-[#2D3436]">{amount}</span>
                <span className="text-lg text-[#9B9590] ml-1.5 font-semibold">{selectedCoin?.symbol}</span>
              </div>
              <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3] space-y-3 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">Recipient</span>
                  <span className="font-mono text-[13px] font-medium text-[#2D3436]">
                    {mintTo.slice(0, 10)}...{mintTo.slice(-6)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[#EDE9E3]">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">Transaction</span>
                  <button
                    onClick={() => window.open(getExplorerTxUrl(txHash), '_blank')}
                    className="flex items-center gap-1 text-[13px] text-lavender hover:text-lavender/80 transition-colors cursor-pointer"
                  >
                    <span className="font-mono">
                      {txHash.slice(0, 8)}...{txHash.slice(-4)}
                    </span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                onClick={() => window.open(getExplorerTxUrl(txHash), '_blank')}
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
              <DialogTitle className="text-lg font-bold text-[#2D3436]">Mint {selectedCoin?.symbol}</DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">Issue new tokens to an address</DialogDescription>
            </div>
            <div className="px-6 pb-4">
              <div className="space-y-3">
                <ContactPicker
                  value={mintTo}
                  onChange={setMintTo}
                  label="Mint To"
                />
                <div>
                  <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block">
                    Amount
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] text-[14px] text-[#2D3436] placeholder:text-[#B5B0AA] focus:border-lavender/40 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>
            {feeToken && tokens.length > 0 && (
              <div className="px-6 pb-4">
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
                className="flex-1 h-11 rounded-xl font-semibold bg-lavender hover:bg-lavender/80 text-white"
                onClick={handleSubmit}
                disabled={isSubmitting || !amount || !mintTo}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                {isSubmitting ? 'Minting...' : 'Mint'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
