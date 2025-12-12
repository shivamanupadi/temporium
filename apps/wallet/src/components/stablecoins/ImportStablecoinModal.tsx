import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, AlertCircle, Coins } from 'lucide-react';
import { toast } from 'sonner';
import { isAddress, type Address } from 'viem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Actions, tempoPublicClient } from '@/lib/tempo-client';
import { useStablecoins, type TokenMetadata } from '@/hooks/useStablecoins';

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
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden rounded-2xl">
        {/* INPUT STATE */}
        {modalState === 'input' && (
          <>
            <div className="px-6 pt-6 pb-4">
              <DialogTitle className="text-lg font-semibold">Import TIP20 Token</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Enter the token contract address
              </DialogDescription>
            </div>

            <div className="px-6 pb-6">
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Token Address
                  </label>
                  <Input
                    placeholder="0x..."
                    value={tokenAddress}
                    onChange={e => {
                      setTokenAddress(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={handleKeyDown}
                    className="h-10 font-mono text-[13px]"
                  />
                  {error && (
                    <div className="flex items-center gap-1.5 mt-2 text-destructive">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span className="text-[12px]">{error}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <Button variant="outline" className="flex-1" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleValidate}
                  disabled={isValidating || !tokenAddress.trim()}
                >
                  {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Validate'}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* CONFIRM STATE */}
        {modalState === 'confirm' && tokenMetadata && (
          <>
            <div className="px-6 pt-6 pb-4">
              <DialogTitle className="text-lg font-semibold">Confirm Import</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Review the token details before importing
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
                      {tokenMetadata.name} ({tokenMetadata.symbol})
                    </p>
                  </div>
                </div>
              </div>

              {/* Details Card */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Currency</span>
                  <span className="text-xs font-medium text-foreground">
                    {tokenMetadata.currency}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Decimals</span>
                  <span className="text-xs font-medium text-foreground">
                    {tokenMetadata.decimals}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Address</span>
                  <span className="text-xs font-mono text-foreground">
                    {tokenAddress.slice(0, 8)}...{tokenAddress.slice(-6)}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setTokenMetadata(null);
                  setModalState('input');
                }}
                disabled={isImporting}
              >
                Back
              </Button>
              <Button className="flex-1" onClick={handleImport} disabled={isImporting}>
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing
                  </>
                ) : (
                  'Import'
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
