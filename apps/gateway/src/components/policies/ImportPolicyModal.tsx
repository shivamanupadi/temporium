import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, ShieldCheck, ShieldX } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { usePolicies } from '@/hooks/usePolicies';
import { Actions, tempoPublicClient } from '@/lib/tempo-client';
import { formatAddress } from '@/lib/utils';
import type { PolicyType } from '@/types';
import type { Address } from 'viem';

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
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const isImportingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setPolicyIdInput('');
      setPolicyPreview(null);
      setModalState('input');
      setIsLoading(false);
      setIsImporting(false);
    }
  }, [isOpen]);

  const handleFetch = useCallback(async (): Promise<void> => {
    if (!policyIdInput) {
      toast.error('Please enter a policy ID');
      return;
    }

    setIsLoading(true);
    try {
      const policyId = BigInt(policyIdInput);
      const data = await Actions.policy.getData(tempoPublicClient, { policyId });

      setPolicyPreview({
        policyId,
        type: data.type,
        admin: data.admin,
      });
      setModalState('confirm');
    } catch (error) {
      toast.error('Policy not found or invalid');
    } finally {
      setIsLoading(false);
    }
  }, [policyIdInput]);

  const handleImport = useCallback(async (): Promise<void> => {
    if (!policyPreview) return;

    setIsImporting(true);
    isImportingRef.current = true;
    try {
      await importPolicy({ policyId: policyPreview.policyId });
      toast.success(`Policy #${policyPreview.policyId} imported!`);
      onSuccess();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import policy';
      toast.error(message);
    } finally {
      setIsImporting(false);
      isImportingRef.current = false;
    }
  }, [policyPreview, importPolicy, onSuccess, onClose]);

  const handleClose = useCallback((): void => {
    if (!isImporting && !isImportingRef.current) {
      onClose();
    }
  }, [isImporting, onClose]);

  const isWhitelist = policyPreview?.type === 'whitelist';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden rounded-2xl">
        {/* INPUT STATE */}
        {modalState === 'input' && (
          <>
            <div className="px-6 pt-6 pb-4">
              <DialogTitle className="text-lg font-semibold">Import Policy</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Import an existing TIP403 policy by ID
              </DialogDescription>
            </div>

            <div className="px-6 pb-6">
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Policy ID
                  </label>
                  <Input
                    placeholder="Enter policy ID (e.g., 2)"
                    value={policyIdInput}
                    onChange={e => setPolicyIdInput(e.target.value.replace(/[^0-9]/g, ''))}
                    className="h-10 font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Enter the on-chain policy ID number
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <Button variant="outline" className="flex-1" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleFetch}
                  disabled={!policyIdInput || isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading
                    </>
                  ) : (
                    'Lookup'
                  )}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* CONFIRM STATE */}
        {modalState === 'confirm' && policyPreview && (
          <>
            <div className="px-6 pt-6 pb-4">
              <DialogTitle className="text-lg font-semibold">Confirm Import</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Review policy details before importing
              </DialogDescription>
            </div>

            <div className="px-6 pb-6">
              {/* Policy Info Card */}
              <div
                className={`rounded-xl p-4 mb-4 ${isWhitelist ? 'bg-emerald-50' : 'bg-rose-50'}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isWhitelist ? 'bg-emerald-100' : 'bg-rose-100'
                    }`}
                  >
                    {isWhitelist ? (
                      <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <ShieldX className="h-5 w-5 text-rose-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Policy</p>
                    <p className="text-lg font-semibold text-foreground">
                      #{policyPreview.policyId.toString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Details Card */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Type</span>
                  <span
                    className={`text-xs font-medium ${isWhitelist ? 'text-emerald-600' : 'text-rose-600'}`}
                  >
                    {isWhitelist ? 'Whitelist' : 'Blacklist'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Admin</span>
                  <span className="text-xs font-mono text-foreground">
                    {formatAddress(policyPreview.admin, 8)}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setModalState('input')}
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
