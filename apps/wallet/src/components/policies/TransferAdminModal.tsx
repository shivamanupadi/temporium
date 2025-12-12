import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, Check, AlertTriangle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { isAddress } from 'viem';
import { Button } from '@/components/ui/button';
import { FeeTokenSelector } from '@/components/FeeTokenSelector';
import { AddressInput } from '@/components/AddressInput';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { usePolicies } from '@/hooks/usePolicies';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { formatAddress } from '@/lib/utils';
import type { Token } from '@/lib/tokenlist';
import type { Address } from 'viem';

interface TransferAdminModalProps {
  isOpen: boolean;
  policyId: bigint;
  currentAdmin: Address;
  onSuccess: () => void;
  onClose: () => void;
}

type ModalState = 'form' | 'confirm' | 'success';

export function TransferAdminModal({
  isOpen,
  policyId,
  currentAdmin,
  onSuccess,
  onClose,
}: TransferAdminModalProps): ReactElement {
  const { transferAdmin } = usePolicies();

  const [newAdmin, setNewAdmin] = useState('');
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [modalState, setModalState] = useState<ModalState>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string>('');
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setNewAdmin('');
      setModalState('form');
      setIsSubmitting(false);
      setTxHash('');
    }
  }, [isOpen]);

  const handleReview = useCallback((): void => {
    if (!newAdmin || !isAddress(newAdmin)) {
      toast.error('Please enter a valid address');
      return;
    }
    if (newAdmin.toLowerCase() === currentAdmin.toLowerCase()) {
      toast.error('New admin must be different from current admin');
      return;
    }
    setModalState('confirm');
  }, [newAdmin, currentAdmin]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!newAdmin || !isAddress(newAdmin)) return;

    setIsSubmitting(true);
    isSubmittingRef.current = true;
    try {
      const result = await transferAdmin({
        policyId,
        admin: newAdmin as Address,
        feeToken: feeToken?.address,
      });

      setTxHash(result.receipt.transactionHash);
      setModalState('success');
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to transfer admin';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [newAdmin, policyId, feeToken, transferAdmin, onSuccess]);

  const handleClose = useCallback((): void => {
    if (!isSubmitting && !isSubmittingRef.current) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden rounded-2xl">
        {/* FORM STATE */}
        {modalState === 'form' && (
          <>
            <div className="px-6 pt-6 pb-4">
              <DialogTitle className="text-lg font-semibold">Transfer Admin</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Transfer policy ownership to another address
              </DialogDescription>
            </div>

            <div className="px-6 pb-6">
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-[11px] text-muted-foreground">Current Admin</p>
                  <p className="text-sm font-mono text-foreground">
                    {formatAddress(currentAdmin, 8)}
                  </p>
                </div>

                <AddressInput
                  label="New Admin Address"
                  value={newAdmin}
                  onChange={setNewAdmin}
                  placeholder="0x..."
                />

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
                <Button
                  className="flex-1"
                  onClick={handleReview}
                  disabled={!newAdmin || !isAddress(newAdmin)}
                >
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
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold">Confirm Transfer</DialogTitle>
                </div>
              </div>
              <DialogDescription className="text-sm text-muted-foreground">
                This action cannot be undone. You will lose admin access to this policy.
              </DialogDescription>
            </div>

            <div className="px-6 pb-6">
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">From</span>
                  <span className="text-xs font-mono text-foreground">
                    {formatAddress(currentAdmin, 8)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">To</span>
                  <span className="text-xs font-mono text-foreground">
                    {formatAddress(newAdmin, 8)}
                  </span>
                </div>
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
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Transferring
                  </>
                ) : (
                  'Transfer'
                )}
              </Button>
            </div>
          </>
        )}

        {/* SUCCESS STATE */}
        {modalState === 'success' && (
          <div className="p-5">
            <DialogTitle className="text-[15px] font-semibold mb-4">Admin Transferred!</DialogTitle>
            <DialogDescription className="sr-only">
              Policy admin has been transferred
            </DialogDescription>

            <div className="text-center pt-4">
              {/* Success icon */}
              <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-6">
                <Check className="h-7 w-7 text-white" />
              </div>

              {/* Success text */}
              <p className="text-foreground text-sm font-semibold mb-1">Admin Transferred</p>

              {/* New admin address */}
              <div className="mb-6">
                <span className="text-lg font-mono text-foreground">
                  {formatAddress(newAdmin, 8)}
                </span>
              </div>

              {/* Details card */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-3 text-left mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Previous Admin</span>
                  <span className="font-mono text-xs text-foreground">
                    {formatAddress(currentAdmin, 8)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">New Admin</span>
                  <span className="font-mono text-xs text-foreground">
                    {formatAddress(newAdmin, 8)}
                  </span>
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
