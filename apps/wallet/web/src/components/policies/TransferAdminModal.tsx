import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, ExternalLink, AlertTriangle } from 'lucide-react';
import { toast } from '@/lib/toast';
import { isAddress, type Address } from 'viem';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@temporium/shared-ui';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import { ContactPicker } from '@/components/ContactPicker';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { formatAddress } from '@/lib/utils';
import { usePolicies } from '@/hooks/usePolicies';
import { useTokenList } from '@/hooks/useTokenList';
import type { Token } from '@/lib/tokenlist';
import type { PolicyType } from '@/types';

interface TransferAdminModalProps {
  isOpen: boolean;
  policyId: bigint;
  policyType: PolicyType;
  currentAdmin: string;
  onSuccess: () => void;
  onClose: () => void;
}

type ModalState = 'form' | 'confirm' | 'success';

export function TransferAdminModal({
  isOpen,
  policyId,
  policyType,
  currentAdmin,
  onSuccess,
  onClose,
}: TransferAdminModalProps): ReactElement {
  const isWhitelist = policyType === 'whitelist';
  const { transferAdmin } = usePolicies();
  const { tokens } = useTokenList();

  const [newAdmin, setNewAdmin] = useState('');
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [modalState, setModalState] = useState<ModalState>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string>('');
  const isSubmittingRef = useRef(false);

  // Reset form only when modal opens (not when tokens refetch)
  useEffect(() => {
    if (isOpen) {
      setNewAdmin('');
      setFeeToken(tokens[0] ?? null);
      setModalState('form');
      setIsSubmitting(false);
      setTxHash('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleReview = useCallback((): void => {
    const trimmed = newAdmin.trim();

    if (!trimmed) {
      toast.error('Please enter a new admin address');
      return;
    }

    if (!isAddress(trimmed)) {
      toast.error('Invalid address format');
      return;
    }

    if (trimmed.toLowerCase() === currentAdmin.toLowerCase()) {
      toast.error('New admin cannot be the same as current admin');
      return;
    }

    setModalState('confirm');
  }, [newAdmin, currentAdmin]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    const trimmed = newAdmin.trim();

    setIsSubmitting(true);
    isSubmittingRef.current = true;
    try {
      const result = await transferAdmin({
        policyId,
        admin: trimmed as Address,
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
      <DialogContent className="sm:max-w-[400px] p-0 gap-0 rounded-2xl">
        {/* FORM STATE */}
        {modalState === 'form' && (
          <>
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">Transfer Admin</DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                Transfer policy admin to another address
              </DialogDescription>
            </div>

            <div className="px-6 pb-4">
              <div className="space-y-3">
                {/* Current Admin Card */}
                <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3]">
                  <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-1">
                    Current Admin
                  </p>
                  <p className="text-[14px] font-mono font-medium text-[#2D3436]">
                    {formatAddress(currentAdmin, 8)}
                  </p>
                </div>

                <ContactPicker value={newAdmin} onChange={setNewAdmin} label="New Admin Address" />
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
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                className={`flex-1 h-11 rounded-xl font-semibold text-white ${isWhitelist ? 'bg-[var(--color-sage)] hover:bg-[var(--color-sage)]/80' : 'bg-coral hover:bg-coral/80'}`}
                onClick={handleReview}
                disabled={!newAdmin.trim()}
              >
                Review
              </Button>
            </div>
          </>
        )}

        {/* CONFIRM STATE */}
        {modalState === 'confirm' && (
          <>
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">
                Confirm Transfer
              </DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                Review admin transfer details carefully
              </DialogDescription>
            </div>

            <div className="px-6 pb-4">
              {/* Warning Box */}
              <div className="bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded-xl p-3 mb-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] mt-0.5 shrink-0" />
                  <p className="text-xs text-[var(--color-warning)]">
                    This action cannot be undone. You will lose admin access to this policy.
                  </p>
                </div>
              </div>

              {/* Details Card */}
              <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    Policy
                  </span>
                  <span className="text-[13px] font-medium text-[#2D3436] font-mono">
                    #{policyId.toString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    From
                  </span>
                  <span className="text-[13px] font-medium text-[#2D3436] font-mono">
                    {formatAddress(currentAdmin, 6)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    To
                  </span>
                  <span className="text-[13px] font-medium text-[#2D3436] font-mono">
                    {formatAddress(newAdmin.trim(), 6)}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                onClick={() => setModalState('form')}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl font-semibold bg-coral hover:bg-coral/80 text-white"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                {isSubmitting ? 'Transferring...' : 'Transfer'}
              </Button>
            </div>
          </>
        )}

        {/* SUCCESS STATE */}
        {modalState === 'success' && (
          <>
            <DialogTitle className="sr-only">Admin Transferred!</DialogTitle>
            <DialogDescription className="sr-only">
              Policy admin has been transferred
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
              <p className="text-[15px] font-bold text-[#2D3436] mb-1">Admin Transferred!</p>

              {/* Hero value */}
              <div className="mb-6">
                <span className="text-3xl font-bold text-[#2D3436]">Admin Transferred</span>
              </div>

              {/* Details card */}
              <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3] space-y-3 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    From
                  </span>
                  <span className="text-[13px] font-medium text-[#2D3436] font-mono">
                    {formatAddress(currentAdmin, 6)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    To
                  </span>
                  <span className="text-[13px] font-medium text-[#2D3436] font-mono">
                    {formatAddress(newAdmin.trim(), 6)}
                  </span>
                </div>
                {txHash && (
                  <div className="flex items-center justify-between pt-2 border-t border-[#EDE9E3]">
                    <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                      Transaction
                    </span>
                    <span className="font-mono text-[12px] text-[#2D3436]">
                      {txHash.slice(0, 10)}...{txHash.slice(-4)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              {txHash && (
                <Button
                  variant="outline"
                  onClick={() => window.open(getExplorerTxUrl(txHash), '_blank')}
                  className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Explorer
                </Button>
              )}
              <Button
                className="flex-1 h-11 rounded-xl font-semibold bg-[var(--color-sage)] hover:bg-[var(--color-sage)]/80 text-white"
                onClick={onClose}
              >
                Done
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
