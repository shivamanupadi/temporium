import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, Link2, ExternalLink, ShieldCheck, ShieldX, Keyboard } from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@temporium/shared-ui';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import { Actions, tempoPublicClient, getExplorerTxUrl } from '@/lib/tempo-client';
import { formatAddress } from '@/lib/utils';
import { useTokenList } from '@/hooks/useTokenList';
import { usePolicies, type PolicyWithMetadata } from '@/hooks/usePolicies';
import type { Token } from '@/lib/tokenlist';
import type { StablecoinWithMetadata, PolicyType } from '@/types';
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

type ModalState = 'picker' | 'input' | 'confirm' | 'success';

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
  const { tokens } = useTokenList();
  const { policies, isLoading: isLoadingPolicies } = usePolicies();

  const [policyIdInput, setPolicyIdInput] = useState('');
  const [policyPreview, setPolicyPreview] = useState<PolicyPreview | null>(null);
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [modalState, setModalState] = useState<ModalState>('picker');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string>('');
  const isSubmittingRef = useRef(false);

  // Reset form only when modal opens (not when tokens refetch)
  useEffect(() => {
    if (isOpen) {
      setPolicyIdInput('');
      setPolicyPreview(null);
      setModalState('picker');
      setIsLoading(false);
      setIsSubmitting(false);
      setTxHash('');
      setFeeToken(tokens[0] ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSelectPolicy = useCallback((policy: PolicyWithMetadata): void => {
    setPolicyPreview({
      policyId: BigInt(policy.policyId),
      type: policy.type,
      admin: policy.admin as Address,
    });
    setModalState('confirm');
  }, []);

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
      <DialogContent className="sm:max-w-[400px] p-0 gap-0 rounded-2xl">
        {/* PICKER STATE */}
        {modalState === 'picker' && (
          <>
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">
                Link Existing Restriction List
              </DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                Select a restriction list to apply to {selectedCoin.symbol}
              </DialogDescription>
            </div>

            <div className="px-6 pb-4">
              {isLoadingPolicies ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="text-[13px] text-[#9B9590] ml-2">Loading...</span>
                </div>
              ) : policies.length > 0 ? (
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {policies.map(policy => {
                    const isWhitelist = policy.type === 'whitelist';
                    return (
                      <button
                        key={policy.id}
                        onClick={() => handleSelectPolicy(policy)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-[#EDE9E3] hover:bg-[#F5F2ED]/50 hover:border-[#D1CCC7] transition-colors cursor-pointer text-left"
                      >
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                            isWhitelist ? 'bg-[var(--color-sage)]/10' : 'bg-coral/8'
                          }`}
                        >
                          {isWhitelist ? (
                            <ShieldCheck className="h-4 w-4 text-[var(--color-sage)]" />
                          ) : (
                            <ShieldX className="h-4 w-4 text-coral" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-medium text-[#2D3436]">
                              {isWhitelist ? 'Allowed List' : 'Blocked List'}
                            </p>
                            <span className="text-[10px] font-medium text-[#9B9590] bg-[#F5F2ED] px-1.5 py-0.5 rounded">
                              #{policy.policyId}
                            </span>
                            {policy.isAdmin && (
                              <span className="text-[10px] font-medium text-[var(--color-sage)] bg-[var(--color-sage)]/10 px-1.5 py-0.5 rounded">
                                Admin
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#9B9590] font-mono mt-0.5">
                            {formatAddress(policy.admin, 6)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-[13px] text-[#9B9590]">No restriction lists found</p>
                  <p className="text-[11px] text-[#B5B0AA] mt-1">
                    Enter a policy ID manually below
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 pb-4 border-t border-[#EDE9E3]/50 pt-3">
              <button
                onClick={() => setModalState('input')}
                className="flex items-center gap-2 text-[12px] text-coral hover:text-coral/80 transition-colors cursor-pointer"
              >
                <Keyboard className="h-3.5 w-3.5" />
                Enter policy ID manually
              </button>
            </div>

            <div className="px-6 pb-6">
              <Button
                variant="outline"
                className="w-full h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                onClick={onClose}
              >
                Cancel
              </Button>
            </div>
          </>
        )}

        {/* INPUT STATE */}
        {modalState === 'input' && (
          <>
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">Link Policy</DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                Apply a TIP403 policy to {selectedCoin.symbol} for transfer restrictions
              </DialogDescription>
            </div>

            <div className="px-6 pb-4">
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block">
                    Policy ID
                  </label>
                  <input
                    placeholder="Enter policy ID"
                    value={policyIdInput}
                    onChange={e => setPolicyIdInput(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] text-[14px] text-[#2D3436] font-mono placeholder:text-[#B5B0AA] focus:border-coral/40 focus:outline-none transition-colors"
                    type="text"
                    inputMode="numeric"
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
                onClick={() => setModalState('picker')}
              >
                Back
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl font-semibold bg-coral hover:bg-coral/80 text-white"
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
          </>
        )}

        {/* CONFIRM STATE */}
        {modalState === 'confirm' && policyPreview && (
          <>
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">Confirm Link</DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                Review policy details before linking
              </DialogDescription>
            </div>

            <div className="px-6 pb-4">
              {/* Policy Info Card */}
              <div
                className={`rounded-xl p-4 mb-3 border ${isWhitelist ? 'bg-[var(--color-sage)]/10 border-[var(--color-sage)]/20' : 'bg-coral/5 border-coral/20'}`}
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
                    <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                      Policy
                    </p>
                    <p
                      className={`text-lg font-semibold ${isWhitelist ? 'text-[var(--color-sage)]' : 'text-coral'}`}
                    >
                      {isWhitelist ? 'Whitelist' : 'Blacklist'} #{policyPreview.policyId.toString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Details Card */}
              <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    Token
                  </span>
                  <span className="text-[13px] font-medium text-[#2D3436]">
                    {selectedCoin.name} ({selectedCoin.symbol})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    Policy ID
                  </span>
                  <span className="text-[13px] font-medium text-[#2D3436] font-mono">
                    {policyPreview.policyId.toString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    Type
                  </span>
                  <span
                    className={`text-[13px] font-medium ${isWhitelist ? 'text-[var(--color-sage)]' : 'text-coral'}`}
                  >
                    {isWhitelist ? 'Whitelist' : 'Blacklist'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    Admin
                  </span>
                  <span className="text-[13px] font-medium text-[#2D3436] font-mono">
                    {formatAddress(policyPreview.admin, 8)}
                  </span>
                </div>
              </div>

              {/* Warning box */}
              <div className="bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded-xl p-3 mt-3">
                <p className="text-xs text-[var(--color-warning)]">
                  {isWhitelist
                    ? 'Only addresses in the whitelist will be able to transfer this token.'
                    : 'Addresses in the blacklist will be blocked from transferring this token.'}
                </p>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                onClick={() => setModalState('picker')}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl font-semibold bg-coral hover:bg-coral/80 text-white"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
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
          <>
            <DialogTitle className="sr-only">Policy Linked!</DialogTitle>
            <DialogDescription className="sr-only">
              Transfer policy applied successfully
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
              <p className="text-[15px] font-bold text-[#2D3436] mb-1">Policy Linked!</p>

              {/* Hero value */}
              <div className="mb-6">
                <span className="text-3xl font-bold text-[#2D3436]">
                  {isWhitelist ? 'Whitelist' : 'Blacklist'}
                </span>
                <span className="text-lg text-[#9B9590] ml-1.5 font-semibold">
                  #{policyPreview.policyId.toString()}
                </span>
              </div>

              {/* Details card */}
              <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3] space-y-3 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    Token
                  </span>
                  <span className="text-[13px] font-medium text-[#2D3436]">
                    {selectedCoin.symbol}
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
