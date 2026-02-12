import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, AlertCircle, Download } from 'lucide-react';
import { toast } from 'sonner';
import { isAddress, type Address } from 'viem';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@temporium/shared-ui';
import { Actions, tempoPublicClient } from '@/lib/tempo-client';
import { useStablecoins } from '@/hooks/useStablecoins';
import { formatAddress } from '@/lib/utils';
import type { TokenMetadata } from '@/types';

interface ImportStablecoinModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

type ModalState = 'input' | 'confirm';

export function ImportStablecoinModal({
  isOpen,
  onSuccess,
  onClose,
}: ImportStablecoinModalProps): ReactElement {
  const { importStablecoin } = useStablecoins();

  const [tokenAddress, setTokenAddress] = useState('');
  const [modalState, setModalState] = useState<ModalState>('input');
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [tokenMetadata, setTokenMetadata] = useState<TokenMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setTokenAddress('');
      setTokenMetadata(null);
      setError(null);
      setIsValidating(false);
      setIsImporting(false);
      setModalState('input');
    }
  }, [isOpen]);

  const handleValidate = useCallback(async (): Promise<void> => {
    const trimmed = tokenAddress.trim();

    if (!trimmed) {
      setError('Please enter a token address');
      return;
    }

    if (!isAddress(trimmed)) {
      setError('Invalid address format');
      return;
    }

    setIsValidating(true);
    isProcessingRef.current = true;
    setError(null);

    try {
      const metadata = await Actions.token.getMetadata(tempoPublicClient, {
        token: trimmed as Address,
      });

      if (!metadata || !metadata.name) {
        setError('Token not found or invalid');
        return;
      }

      setTokenMetadata(metadata as TokenMetadata);
      setModalState('confirm');
    } catch (err) {
      console.error('Failed to fetch token metadata:', err);
      setError('Failed to fetch token. Please check the address.');
    } finally {
      setIsValidating(false);
      isProcessingRef.current = false;
    }
  }, [tokenAddress]);

  const handleImport = useCallback(async (): Promise<void> => {
    if (!tokenMetadata) return;

    setIsImporting(true);
    isProcessingRef.current = true;
    try {
      await importStablecoin({
        address: tokenAddress.trim() as Address,
        name: tokenMetadata.name,
        symbol: tokenMetadata.symbol,
        currency: tokenMetadata.currency,
      });

      toast.success(`${tokenMetadata.name} imported`);
      onSuccess();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import token';
      toast.error(message);
    } finally {
      setIsImporting(false);
      isProcessingRef.current = false;
    }
  }, [tokenAddress, tokenMetadata, importStablecoin, onSuccess, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): void => {
      if (e.key === 'Enter' && !isValidating && modalState === 'input') {
        handleValidate();
      }
    },
    [isValidating, modalState, handleValidate]
  );

  const handleClose = useCallback((): void => {
    if (!isValidating && !isImporting && !isProcessingRef.current) {
      onClose();
    }
  }, [isValidating, isImporting, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px] p-0 gap-0 rounded-2xl">
        {modalState === 'input' && (
          <>
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">
                Import Token
              </DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                Enter the TIP-20 token contract address
              </DialogDescription>
            </div>

            <div className="px-6 pb-4">
              <div>
                <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block">
                  Token Address
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={tokenAddress}
                  onChange={e => {
                    setTokenAddress(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={handleKeyDown}
                  className="w-full px-4 py-3 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] text-[14px] text-[#2D3436] font-mono placeholder:text-[#B5B0AA] focus:border-lavender/40 focus:outline-none transition-colors"
                />
                {error && (
                  <div className="flex items-center gap-1.5 mt-2 text-coral">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span className="text-[12px]">{error}</span>
                  </div>
                )}
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
                className="flex-1 h-11 rounded-xl font-semibold bg-lavender hover:bg-lavender/80 text-white"
                onClick={handleValidate}
                disabled={isValidating || !tokenAddress.trim()}
              >
                {isValidating ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : null}
                {isValidating ? 'Validating...' : 'Validate'}
              </Button>
            </div>
          </>
        )}

        {modalState === 'confirm' && tokenMetadata && (
          <>
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">
                Confirm Import
              </DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                Review the token details before importing
              </DialogDescription>
            </div>

            <div className="px-6 pb-4 space-y-3">
              <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
                <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-1">
                  Token
                </p>
                <p className="text-lg font-bold text-[#2D3436]">
                  {tokenMetadata.name}{' '}
                  <span className="text-[14px] font-semibold text-[#9B9590]">
                    {tokenMetadata.symbol}
                  </span>
                </p>
              </div>

              <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    Currency
                  </span>
                  <span className="text-[13px] font-medium text-[#2D3436]">{tokenMetadata.currency}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    Decimals
                  </span>
                  <span className="text-[13px] font-medium text-[#2D3436]">{tokenMetadata.decimals}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    Address
                  </span>
                  <span className="text-[13px] font-mono text-[#2D3436]">{formatAddress(tokenAddress, 6)}</span>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                onClick={() => {
                  setTokenMetadata(null);
                  setModalState('input');
                }}
                disabled={isImporting}
              >
                Back
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl font-semibold bg-lavender hover:bg-lavender/80 text-white"
                onClick={handleImport}
                disabled={isImporting}
              >
                {isImporting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <Download className="w-4 h-4 mr-1.5" />
                )}
                {isImporting ? 'Importing...' : 'Import'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
