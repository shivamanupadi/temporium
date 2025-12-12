import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, Link2, Check, ExternalLink, ShieldCheck, ShieldX } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PolicyIdInput } from '@/components/PolicyIdInput';
import { FeeTokenSelector } from '@/components/FeeTokenSelector';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Actions, tempoPublicClient, getExplorerTxUrl } from '@/lib/tempo-client';
import { formatAddress } from '@/lib/utils';
import type { Token } from '@/lib/tokenlist';
import type { StablecoinWithMetadata } from '@/hooks/useStablecoins';
import type { PolicyType } from '@/types';
import type { Address } from 'viem';

interface LinkPolicyModalProps {
  isOpen: boolean;
  selectedCoin: StablecoinWithMetadata | null;
  onLink: (params: {
    policyId: bigint;
    feeToken?: Address;
  }) => Promise<{ receipt: { transactionHash: string } }>;
  onSuccess: () => void;
  onClose: () => void;
}

type ModalState = 'input' | 'confirm' | 'success';

interface PolicyPreview {
  policyId: bigint;
  type: PolicyType;
  admin: Address;
}

export function LinkPolicyModal({
  isOpen,
  selectedCoin,
  onLink,
  onSuccess,
  onClose,
}: LinkPolicyModalProps): ReactElement {
  const [policyIdInput, setPolicyIdInput] = useState('');
  const [policyPreview, setPolicyPreview] = useState<PolicyPreview | null>(null);
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [modalState, setModalState] = useState<ModalState>('input');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string>('');
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setPolicyIdInput('');
      setPolicyPreview(null);
      setModalState('input');
      setIsLoading(false);
      setIsSubmitting(false);
      setTxHash('');
      setFeeToken(null);
    }
  }, [isOpen]);

  const handleLookup = useCallback(async (): Promise<void> => {
    if (!policyIdInput) {
      toast.error('Please enter a policy ID');
      return;
    }

    const policyId = BigInt(policyIdInput);

    // Validate policy ID
    if (policyId === 0n) {
      toast.error('Policy ID 0 (always-reject) cannot be linked');
      return;
    }
    if (policyId === 1n) {
      toast.error('Policy ID 1 (always-allow) means no restrictions');
      return;
    }

    setIsLoading(true);
    try {
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

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!policyPreview) return;

    setIsSubmitting(true);
    isSubmittingRef.current = true;
    try {
      const result = await onLink({
        policyId: policyPreview.policyId,
        feeToken: feeToken?.address,
      });

      setTxHash(result.receipt.transactionHash);
      setModalState('success');
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to link policy';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [policyPreview, feeToken, onLink, onSuccess]);

  const handleClose = useCallback((): void => {
    if (!isSubmitting && !isSubmittingRef.current) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  if (!selectedCoin) return <></>;

  const isWhitelist = policyPreview?.type === 'whitelist';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden rounded-2xl">
        {/* INPUT STATE */}
        {modalState === 'input' && (
          <>
            <div className="px-6 pt-6 pb-4">
              <DialogTitle className="text-lg font-semibold">Link Policy</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Apply a TIP403 policy to {selectedCoin.symbol} for transfer restrictions
              </DialogDescription>
            </div>

            <div className="px-6 pb-6">
              <div className="space-y-4">
                <PolicyIdInput
                  label="Policy ID"
                  value={policyIdInput}
                  onChange={setPolicyIdInput}
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
                  onClick={handleLookup}
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
              <DialogTitle className="text-lg font-semibold">Confirm Link</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Review policy details before linking
              </DialogDescription>
            </div>

            <div className="px-6 pb-6">
              {/* Policy Info Card */}
              <div
                className={`rounded-xl p-4 mb-4 ${isWhitelist ? 'bg-emerald-50' : 'bg-rose-50'}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${isWhitelist ? 'bg-emerald-100' : 'bg-rose-100'}`}
                  >
                    {isWhitelist ? (
                      <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <ShieldX className="h-5 w-5 text-rose-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Policy</p>
                    <p
                      className={`text-lg font-semibold ${isWhitelist ? 'text-emerald-600' : 'text-rose-600'}`}
                    >
                      {isWhitelist ? 'Whitelist' : 'Blacklist'} #{policyPreview.policyId.toString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Details Card */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Token</span>
                  <span className="text-xs font-medium text-foreground">
                    {selectedCoin.name} ({selectedCoin.symbol})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Policy ID</span>
                  <span className="text-xs font-mono text-foreground">
                    {policyPreview.policyId.toString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Policy Type</span>
                  <span
                    className={`text-xs font-medium ${isWhitelist ? 'text-emerald-600' : 'text-rose-600'}`}
                  >
                    {isWhitelist ? 'Whitelist' : 'Blacklist'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Policy Admin</span>
                  <span className="text-xs font-mono text-foreground">
                    {formatAddress(policyPreview.admin, 8)}
                  </span>
                </div>
              </div>

              <div className="bg-amber-50 rounded-xl p-3 mt-4">
                <p className="text-xs text-amber-700">
                  {isWhitelist
                    ? 'Only addresses in the whitelist will be able to transfer this token.'
                    : 'Addresses in the blacklist will be blocked from transferring this token.'}
                </p>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setModalState('input')}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Linking
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4" />
                    Link Policy
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {/* SUCCESS STATE */}
        {modalState === 'success' && policyPreview && (
          <div className="p-5">
            <DialogTitle className="text-[15px] font-semibold mb-4">Policy Linked!</DialogTitle>
            <DialogDescription className="sr-only">
              The policy has been applied to the token
            </DialogDescription>

            <div className="text-center pt-4">
              {/* Success icon */}
              <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-6">
                <Check className="h-7 w-7 text-white" />
              </div>

              {/* Success text */}
              <p className="text-foreground text-sm font-semibold mb-1">Policy Applied</p>

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
                  <span className="text-xs text-muted-foreground">Policy</span>
                  <span
                    className={`text-xs font-medium ${isWhitelist ? 'text-emerald-600' : 'text-rose-600'}`}
                  >
                    {isWhitelist ? 'Whitelist' : 'Blacklist'} #{policyPreview.policyId.toString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Token</span>
                  <span className="text-xs font-medium text-foreground">{selectedCoin.symbol}</span>
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
