import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, AlertCircle, Download, ShieldCheck, ShieldX } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@temporium/shared-ui';
import { Actions, tempoPublicClient } from '@/lib/tempo-client';
import { formatAddress } from '@/lib/utils';
import { usePolicies } from '@/hooks/usePolicies';
import type { Address } from 'viem';
import type { PolicyType } from '@/types';

interface ImportPolicyModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

type ModalState = 'input' | 'confirm';

interface PolicyPreview {
  policyId: bigint;
  type: PolicyType;
  admin: Address;
}

export function ImportPolicyModal({
  isOpen,
  onSuccess,
  onClose,
}: ImportPolicyModalProps): ReactElement {
  const { importPolicy } = usePolicies();

  const [policyIdInput, setPolicyIdInput] = useState('');
  const [policyPreview, setPolicyPreview] = useState<PolicyPreview | null>(null);
  const [modalState, setModalState] = useState<ModalState>('input');
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setPolicyIdInput('');
      setPolicyPreview(null);
      setError(null);
      setIsValidating(false);
      setIsImporting(false);
      setModalState('input');
    }
  }, [isOpen]);

  const handleLookup = useCallback(async (): Promise<void> => {
    const trimmed = policyIdInput.trim();

    if (!trimmed) {
      setError('Please enter a policy ID');
      return;
    }

    const policyId = BigInt(trimmed);

    setIsValidating(true);
    isProcessingRef.current = true;
    setError(null);

    try {
      const data = await Actions.policy.getData(tempoPublicClient, { policyId });

      if (!data || !data.admin) {
        setError('Policy not found or invalid');
        return;
      }

      setPolicyPreview({
        policyId,
        type: data.type as PolicyType,
        admin: data.admin,
      });
      setModalState('confirm');
    } catch (err) {
      console.error('Failed to fetch policy data:', err);
      setError('Policy not found. Please check the ID.');
    } finally {
      setIsValidating(false);
      isProcessingRef.current = false;
    }
  }, [policyIdInput]);

  const handleImport = useCallback(async (): Promise<void> => {
    if (!policyPreview) return;

    setIsImporting(true);
    isProcessingRef.current = true;
    try {
      await importPolicy({ policyId: policyPreview.policyId });

      toast.success(`Policy #${policyPreview.policyId.toString()} imported`);
      onSuccess();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import policy';
      toast.error(message);
    } finally {
      setIsImporting(false);
      isProcessingRef.current = false;
    }
  }, [policyPreview, importPolicy, onSuccess, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): void => {
      if (e.key === 'Enter' && !isValidating && modalState === 'input') {
        handleLookup();
      }
    },
    [isValidating, modalState, handleLookup]
  );

  const handleClose = useCallback((): void => {
    if (!isValidating && !isImporting && !isProcessingRef.current) {
      onClose();
    }
  }, [isValidating, isImporting, onClose]);

  const isWhitelist = policyPreview?.type === 'whitelist';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px] p-0 gap-0 rounded-2xl">
        {modalState === 'input' && (
          <>
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">
                Import Policy
              </DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                Enter the TIP403 policy ID to import
              </DialogDescription>
            </div>

            <div className="px-6 pb-4">
              <div>
                <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block">
                  Policy ID
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter policy ID"
                  value={policyIdInput}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    setPolicyIdInput(val);
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
                onClick={handleLookup}
                disabled={isValidating || !policyIdInput.trim()}
              >
                {isValidating ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : null}
                {isValidating ? 'Looking up...' : 'Lookup'}
              </Button>
            </div>
          </>
        )}

        {modalState === 'confirm' && policyPreview && (
          <>
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">
                Confirm Import
              </DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                Review policy details before importing
              </DialogDescription>
            </div>

            <div className="px-6 pb-4 space-y-3">
              {/* Policy Info Card */}
              <div
                className={`rounded-xl p-4 border ${isWhitelist ? 'bg-[var(--color-sage)]/10 border-[var(--color-sage)]/20' : 'bg-coral/5 border-coral/20'}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${isWhitelist ? 'bg-[var(--color-sage)]/15' : 'bg-coral/10'}`}
                  >
                    {isWhitelist ? (
                      <ShieldCheck className="h-5 w-5 text-[var(--color-sage)]" />
                    ) : (
                      <ShieldX className="h-5 w-5 text-coral" />
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">Policy</p>
                    <p className={`text-lg font-semibold ${isWhitelist ? 'text-[var(--color-sage)]' : 'text-coral'}`}>
                      Policy #{policyPreview.policyId.toString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Detail Card */}
              <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">Type</span>
                  <span className={`text-[13px] font-medium ${isWhitelist ? 'text-[var(--color-sage)]' : 'text-coral'}`}>
                    {isWhitelist ? 'Whitelist' : 'Blacklist'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">Admin</span>
                  <span className="text-[13px] font-medium text-[#2D3436] font-mono">
                    {formatAddress(policyPreview.admin, 8)}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                onClick={() => {
                  setPolicyPreview(null);
                  setModalState('input');
                }}
                disabled={isImporting}
              >
                Back
              </Button>
              <Button
                className={`flex-1 h-11 rounded-xl font-semibold text-white ${isWhitelist ? 'bg-[var(--color-sage)] hover:bg-[var(--color-sage)]/80' : 'bg-coral hover:bg-coral/80'}`}
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
