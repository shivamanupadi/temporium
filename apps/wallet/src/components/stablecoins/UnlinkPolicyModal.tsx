import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, Check, ShieldOff, ExternalLink, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FeeTokenSelector } from '@/components/FeeTokenSelector';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import type { Token } from '@/lib/tokenlist';
import type { StablecoinWithMetadata } from '@/hooks/useStablecoins';
import type { Address } from 'viem';

interface UnlinkPolicyModalProps {
  isOpen: boolean;
  selectedCoin: StablecoinWithMetadata | null;
  policyId: bigint;
  policyType: 'whitelist' | 'blacklist';
  onUnlink: (params: {
    policyId: bigint;
    feeToken?: Address;
  }) => Promise<{ receipt: { transactionHash: string } }>;
  onSuccess: () => void;
  onClose: () => void;
}

type ModalState = 'form' | 'confirm' | 'success';

export function UnlinkPolicyModal({
  isOpen,
  selectedCoin,
  policyId,
  policyType,
  onUnlink,
  onSuccess,
  onClose,
}: UnlinkPolicyModalProps): ReactElement {
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [modalState, setModalState] = useState<ModalState>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string>('');
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setModalState('form');
      setIsSubmitting(false);
      setTxHash('');
      setFeeToken(null);
    }
  }, [isOpen]);

  const handleContinue = useCallback((): void => {
    setModalState('confirm');
  }, []);

  const handleSubmit = useCallback(async (): Promise<void> => {
    setIsSubmitting(true);
    isSubmittingRef.current = true;
    try {
      // Set policy to 1 (always-allow) to effectively "unlink"
      const result = await onUnlink({
        policyId: 1n,
        feeToken: feeToken?.address,
      });

      setTxHash(result.receipt.transactionHash);
      setModalState('success');
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to unlink policy';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [feeToken, onUnlink, onSuccess]);

  const handleClose = useCallback((): void => {
    if (!isSubmitting && !isSubmittingRef.current) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  if (!selectedCoin) return <></>;

  const isWhitelist = policyType === 'whitelist';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden rounded-2xl">
        {/* FORM STATE */}
        {modalState === 'form' && (
          <>
            <div className="px-6 pt-6 pb-4">
              <DialogTitle className="text-lg font-semibold">Unlink Policy</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Remove transfer restrictions from {selectedCoin.symbol}
              </DialogDescription>
            </div>

            <div className="px-6 pb-6">
              <div className="space-y-4">
                {/* Current Policy Info */}
                <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Token</span>
                    <span className="text-xs font-medium text-foreground">
                      {selectedCoin.name} ({selectedCoin.symbol})
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Current Policy</span>
                    <span
                      className={`text-xs font-medium ${isWhitelist ? 'text-emerald-600' : 'text-rose-600'}`}
                    >
                      {isWhitelist ? 'Whitelist' : 'Blacklist'} #{policyId.toString()}
                    </span>
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
                <Button className="flex-1" onClick={handleContinue}>
                  Continue
                </Button>
              </div>
            </div>
          </>
        )}

        {/* CONFIRM STATE */}
        {modalState === 'confirm' && (
          <>
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold">Confirm Unlink</DialogTitle>
                </div>
              </div>
              <DialogDescription className="text-sm text-muted-foreground">
                This will remove all transfer restrictions from this token.
              </DialogDescription>
            </div>

            <div className="px-6 pb-6">
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Token</span>
                  <span className="text-xs font-medium text-foreground">
                    {selectedCoin.name} ({selectedCoin.symbol})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Current Policy</span>
                  <span
                    className={`text-xs font-medium ${isWhitelist ? 'text-emerald-600' : 'text-rose-600'}`}
                  >
                    {isWhitelist ? 'Whitelist' : 'Blacklist'} #{policyId.toString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">New Policy</span>
                  <span className="text-xs font-medium text-gray-600">No Restrictions (ID: 1)</span>
                </div>
              </div>

              <div className="bg-amber-50 rounded-xl p-3 mt-4">
                <p className="text-xs text-amber-700">
                  After unlinking, all addresses will be able to send and receive this token without
                  restrictions.
                </p>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setModalState('form')}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Unlinking
                  </>
                ) : (
                  <>
                    <ShieldOff className="h-4 w-4" />
                    Unlink Policy
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {/* SUCCESS STATE */}
        {modalState === 'success' && (
          <div className="p-5">
            <DialogTitle className="text-[15px] font-semibold mb-4">Policy Unlinked!</DialogTitle>
            <DialogDescription className="sr-only">
              The transfer policy has been removed from the token
            </DialogDescription>

            <div className="text-center pt-4">
              {/* Success icon */}
              <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-6">
                <Check className="h-7 w-7 text-white" />
              </div>

              {/* Success text */}
              <p className="text-foreground text-sm font-semibold mb-1">Restrictions Removed</p>

              {/* Token name */}
              <div className="mb-6">
                <span className="text-xl font-semibold text-foreground">{selectedCoin.name}</span>
                <span className="text-lg text-muted-foreground ml-1.5">
                  ({selectedCoin.symbol})
                </span>
              </div>

              {/* Details card */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-3 text-left mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Previous Policy</span>
                  <span
                    className={`text-xs font-medium ${isWhitelist ? 'text-emerald-600' : 'text-rose-600'}`}
                  >
                    {isWhitelist ? 'Whitelist' : 'Blacklist'} #{policyId.toString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">New Policy</span>
                  <span className="text-xs font-medium text-gray-600">No Restrictions</span>
                </div>
                {txHash && (
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
                )}
              </div>

              <Button className="w-full h-10" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
