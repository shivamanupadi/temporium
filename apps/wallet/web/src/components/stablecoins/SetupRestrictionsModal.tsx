import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactElement,
  type ChangeEvent,
} from 'react';
import {
  Loader2,
  ShieldCheck,
  ShieldX,
  ExternalLink,
  AlertTriangle,
  Check,
  Plus,
  ChevronLeft,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@temporium/shared-ui';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import { useWalletClient, useAccount } from 'wagmi';
import { Actions, getExplorerTxUrl } from '@/lib/tempo-client';
import { DEFAULT_FEE_TOKEN_ADDRESS } from '@/lib/constants';
import { useTokenList } from '@/hooks/useTokenList';
import { savePolicy } from '@/lib/policies-storage';
import { usePolicies, type PolicyWithMetadata } from '@/hooks/usePolicies';
import { formatAddress } from '@/lib/utils';
import type { Token } from '@/lib/tokenlist';
import type { StablecoinWithMetadata } from '@/types';
import type { Address } from 'viem';
import { isAddress } from 'viem';

export type RestrictionMode = 'open' | 'allowed-list' | 'blocked-list';

interface SetupRestrictionsModalProps {
  isOpen: boolean;
  selectedCoin: StablecoinWithMetadata | null;
  targetMode: RestrictionMode;
  currentMode: RestrictionMode;
  onChangePolicy: (params: {
    policyId: bigint;
    feeToken?: Address;
  }) => Promise<{ receipt: { transactionHash: string } }>;
  onSuccess: () => void;
  onClose: () => void;
}

type ModalState =
  | 'choose' // pick existing vs create new (only when enabling)
  | 'form' // create new: initial addresses + fee token
  | 'confirm' // confirm: either create+link or link-existing or disable
  | 'creating' // creating new policy (step 1 of 2)
  | 'created' // policy created, awaiting user click for link (step 2 pause)
  | 'linking' // applying policy to token
  | 'success';

// Internal flow: create-new vs use-existing vs disable
type FlowKind = 'create' | 'existing' | 'disable';

export function SetupRestrictionsModal({
  isOpen,
  selectedCoin,
  targetMode,
  currentMode,
  onChangePolicy,
  onSuccess,
  onClose,
}: SetupRestrictionsModalProps): ReactElement {
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const { tokens } = useTokenList();
  const { policies, refresh: refreshPolicies } = usePolicies();

  const [addresses, setAddresses] = useState('');
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [modalState, setModalState] = useState<ModalState>('choose');
  const [flowKind, setFlowKind] = useState<FlowKind>('create');
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyWithMetadata | null>(null);
  const [createdPolicyId, setCreatedPolicyId] = useState<bigint | null>(null);
  const [linkTxHash, setLinkTxHash] = useState('');
  const isProcessingRef = useRef(false);

  const isDisabling = targetMode === 'open';
  const isAllowedList = targetMode === 'allowed-list';
  const isSwitchingType =
    currentMode !== 'open' && targetMode !== 'open' && currentMode !== targetMode;

  // Filter user's policies by target type
  const targetPolicyType = isAllowedList ? 'whitelist' : 'blacklist';
  const matchingPolicies = policies.filter(p => p.type === targetPolicyType);
  const hasMatchingPolicies = matchingPolicies.length > 0;

  useEffect(() => {
    if (isOpen) {
      setAddresses('');
      setFeeToken(tokens[0] ?? null);
      setSelectedPolicy(null);
      setCreatedPolicyId(null);
      setLinkTxHash('');
      // Disabling → skip directly to confirm. Enabling with existing options → choose. Else → form.
      if (isDisabling) {
        setFlowKind('disable');
        setModalState('confirm');
      } else if (hasMatchingPolicies) {
        setModalState('choose');
      } else {
        setFlowKind('create');
        setModalState('form');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const parseAddresses = useCallback((): Address[] => {
    if (!addresses.trim()) return [];
    return addresses
      .split(/[\n,]/)
      .map(addr => addr.trim())
      .filter(addr => addr && isAddress(addr)) as Address[];
  }, [addresses]);

  const getModeLabel = (mode: RestrictionMode): string => {
    switch (mode) {
      case 'open':
        return 'No Restrictions';
      case 'allowed-list':
        return 'Allowed Addresses Only';
      case 'blocked-list':
        return 'Block Specific Addresses';
    }
  };

  // ── Action: disable restrictions (single txn) ──
  const handleDisable = useCallback(async (): Promise<void> => {
    isProcessingRef.current = true;
    setModalState('linking');
    try {
      const result = await onChangePolicy({ policyId: 1n, feeToken: feeToken?.address });
      setLinkTxHash(result.receipt.transactionHash);
      setModalState('success');
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        ticks: 50,
        gravity: 3,
        decay: 0.9,
        scalar: 0.8,
      });
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove restrictions';
      toast.error(message);
      setModalState('confirm');
    } finally {
      isProcessingRef.current = false;
    }
  }, [feeToken, onChangePolicy, onSuccess]);

  // ── Action: link an existing policy (single txn) ──
  const handleLinkExisting = useCallback(async (): Promise<void> => {
    if (!selectedPolicy) return;
    isProcessingRef.current = true;
    setModalState('linking');
    try {
      const result = await onChangePolicy({
        policyId: BigInt(selectedPolicy.policyId),
        feeToken: feeToken?.address,
      });
      setLinkTxHash(result.receipt.transactionHash);
      setModalState('success');
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        ticks: 50,
        gravity: 3,
        decay: 0.9,
        scalar: 0.8,
      });
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to apply restrictions';
      toast.error(message);
      setModalState('confirm');
    } finally {
      isProcessingRef.current = false;
    }
  }, [selectedPolicy, feeToken, onChangePolicy, onSuccess]);

  // ── Action: create new policy (step 1 of 2) ──
  const handleCreate = useCallback(async (): Promise<void> => {
    if (!walletClient || !address) {
      toast.error('Wallet not connected');
      return;
    }
    isProcessingRef.current = true;
    setModalState('creating');
    try {
      const policyType = isAllowedList ? 'whitelist' : 'blacklist';
      const parsedAddresses = parseAddresses();
      const createResult = await Actions.policy.createSync(walletClient, {
        type: policyType,
        addresses: parsedAddresses.length > 0 ? parsedAddresses : undefined,
        feeToken: feeToken?.address ?? DEFAULT_FEE_TOKEN_ADDRESS,
      });
      await savePolicy({
        owner: address,
        policyId: createResult.policyId.toString(),
        type: policyType,
        admin: address,
        txHash: createResult.receipt.transactionHash,
      });
      setCreatedPolicyId(createResult.policyId);
      await refreshPolicies();
      // Stop here — wait for explicit user click to link
      setModalState('created');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create restriction list';
      toast.error(message);
      setModalState('confirm');
    } finally {
      isProcessingRef.current = false;
    }
  }, [walletClient, address, isAllowedList, parseAddresses, feeToken, refreshPolicies]);

  // ── Action: link newly-created policy (step 2 of 2) ──
  const handleLinkCreated = useCallback(async (): Promise<void> => {
    if (!createdPolicyId) return;
    isProcessingRef.current = true;
    setModalState('linking');
    try {
      const result = await onChangePolicy({
        policyId: createdPolicyId,
        feeToken: feeToken?.address,
      });
      setLinkTxHash(result.receipt.transactionHash);
      setModalState('success');
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        ticks: 50,
        gravity: 3,
        decay: 0.9,
        scalar: 0.8,
      });
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to apply restrictions';
      toast.error(message);
      setModalState('created');
    } finally {
      isProcessingRef.current = false;
    }
  }, [createdPolicyId, feeToken, onChangePolicy, onSuccess]);

  const handleClose = useCallback((): void => {
    if (!isProcessingRef.current) onClose();
  }, [onClose]);

  if (!selectedCoin) return <></>;

  const parsedAddresses = parseAddresses();
  const accentColor = isAllowedList ? 'sage' : 'coral';
  const primaryBtnClass = isDisabling
    ? 'bg-coral hover:bg-coral/80'
    : isAllowedList
      ? 'bg-[var(--color-sage)] hover:bg-[var(--color-sage)]/80'
      : 'bg-coral hover:bg-coral/80';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[420px] p-0 gap-0 rounded-2xl">
        {/* ═══ CHOOSE STATE ═══ */}
        {modalState === 'choose' && (
          <>
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">
                {isSwitchingType ? 'Switch to' : 'Enable'}{' '}
                {isAllowedList ? 'Allowed List' : 'Blocked List'}
              </DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                Use an existing list or create a new one for {selectedCoin.symbol}
              </DialogDescription>
            </div>

            <div className="px-6 pb-4 space-y-3">
              <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                Your Existing {isAllowedList ? 'Allowed' : 'Blocked'} Lists
              </p>
              <div className="space-y-2 max-h-[240px] overflow-y-auto">
                {matchingPolicies.map(policy => (
                  <button
                    key={policy.id}
                    onClick={() => {
                      setSelectedPolicy(policy);
                      setFlowKind('existing');
                      setModalState('confirm');
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border border-[#EDE9E3] hover:border-[${accentColor === 'sage' ? 'var(--color-sage)' : '#E07A5F'}] hover:bg-[#F5F2ED]/30 transition-colors cursor-pointer text-left`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isAllowedList ? 'bg-[var(--color-sage)]/10' : 'bg-coral/8'}`}
                    >
                      {isAllowedList ? (
                        <ShieldCheck className="h-4 w-4 text-[var(--color-sage)]" />
                      ) : (
                        <ShieldX className="h-4 w-4 text-coral" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-medium text-[#2D3436]">
                          {isAllowedList ? 'Allowed List' : 'Blocked List'}
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
                ))}
              </div>
            </div>

            <div className="px-6 pb-4 border-t border-[#EDE9E3]/50 pt-3">
              <button
                onClick={() => {
                  setFlowKind('create');
                  setModalState('form');
                }}
                className={`flex items-center gap-2 text-[12px] font-medium transition-colors cursor-pointer ${isAllowedList ? 'text-[var(--color-sage)] hover:text-[var(--color-sage)]/80' : 'text-coral hover:text-coral/80'}`}
              >
                <Plus className="h-3.5 w-3.5" />
                Create a new {isAllowedList ? 'allowed' : 'blocked'} list instead
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

        {/* ═══ FORM STATE (create new) ═══ */}
        {modalState === 'form' && (
          <>
            <div className="px-6 pt-6 pb-5 pr-14">
              {hasMatchingPolicies && (
                <button
                  onClick={() => setModalState('choose')}
                  className="flex items-center gap-1 text-[12px] text-[#9B9590] hover:text-[#2D3436] transition-colors mb-2 cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Back to list
                </button>
              )}
              <DialogTitle className="text-lg font-bold text-[#2D3436]">
                Create New {isAllowedList ? 'Allowed' : 'Blocked'} List
              </DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                Set up a new list for {selectedCoin.symbol}
              </DialogDescription>
            </div>

            <div className="px-6 pb-4 space-y-3">
              <div
                className={`rounded-xl p-4 border ${isAllowedList ? 'bg-[var(--color-sage)]/10 border-[var(--color-sage)]/20' : 'bg-coral/5 border-coral/20'}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${isAllowedList ? 'bg-[var(--color-sage)]/15' : 'bg-coral/10'}`}
                  >
                    {isAllowedList ? (
                      <ShieldCheck className="h-5 w-5 text-[var(--color-sage)]" />
                    ) : (
                      <ShieldX className="h-5 w-5 text-coral" />
                    )}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[#2D3436]">
                      {getModeLabel(targetMode)}
                    </p>
                    <p className="text-[11px] text-[#9B9590]">
                      {isAllowedList
                        ? 'Only addresses you approve will be able to transfer'
                        : 'Specific addresses will be blocked from transferring'}
                    </p>
                  </div>
                </div>
              </div>

              {isSwitchingType && (
                <div className="bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-[var(--color-warning)] shrink-0 mt-0.5" />
                    <p className="text-xs text-[var(--color-warning)]">
                      Your current list won&apos;t carry over. This will create a brand new list.
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block">
                  Initial Addresses (Optional)
                </label>
                <textarea
                  placeholder={'0x1234...\n0x5678...'}
                  value={addresses}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setAddresses(e.target.value)}
                  className="w-full min-h-[80px] px-4 py-3 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] text-[13px] text-[#2D3436] font-mono placeholder:text-[#B5B0AA] focus:border-coral/40 focus:outline-none transition-colors resize-none"
                />
                <p className="text-[11px] text-[#9B9590] mt-1">
                  {isAllowedList
                    ? 'These addresses will be allowed to transfer immediately'
                    : 'These addresses will be blocked from transferring immediately'}
                </p>
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
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                className={`flex-1 h-11 rounded-xl font-semibold text-white ${primaryBtnClass}`}
                onClick={() => setModalState('confirm')}
              >
                Continue
              </Button>
            </div>
          </>
        )}

        {/* ═══ CONFIRM STATE ═══ */}
        {modalState === 'confirm' && (
          <>
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">
                Confirm Changes
              </DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                {flowKind === 'disable'
                  ? 'This will remove all transfer restrictions'
                  : flowKind === 'existing'
                    ? 'Apply this existing list to your token (1 transaction)'
                    : 'Create a new list and apply it (2 transactions)'}
              </DialogDescription>
            </div>

            <div className="px-6 pb-4">
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
                    Current
                  </span>
                  <span className="text-[13px] font-medium text-[#9B9590]">
                    {getModeLabel(currentMode)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    New
                  </span>
                  <span
                    className={`text-[13px] font-medium ${flowKind === 'disable' ? 'text-[#9B9590]' : isAllowedList ? 'text-[var(--color-sage)]' : 'text-coral'}`}
                  >
                    {getModeLabel(targetMode)}
                  </span>
                </div>
                {flowKind === 'existing' && selectedPolicy && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                      Using List
                    </span>
                    <span className="text-[13px] font-medium text-[#2D3436] font-mono">
                      #{selectedPolicy.policyId}
                    </span>
                  </div>
                )}
                {flowKind === 'create' && parsedAddresses.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                      Initial Addresses
                    </span>
                    <span className="text-[13px] font-medium text-[#2D3436]">
                      {parsedAddresses.length}
                    </span>
                  </div>
                )}
              </div>

              {/* Step indicator — only for create flow (2 txns) */}
              {flowKind === 'create' && (
                <div className="mt-3 bg-[#FDFBF8] rounded-xl p-3 border border-[#EDE9E3]">
                  <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2">
                    Steps
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-coral/10 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-coral">1</span>
                      </div>
                      <span className="text-[12px] text-[#2D3436]">
                        Create the list (transaction 1)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-coral/10 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-coral">2</span>
                      </div>
                      <span className="text-[12px] text-[#2D3436]">
                        Apply to {selectedCoin.symbol} (transaction 2)
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {flowKind === 'disable' && (
                <div className="bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded-xl p-3 mt-3">
                  <p className="text-xs text-[var(--color-warning)]">
                    After removing restrictions, all addresses will be able to send and receive{' '}
                    {selectedCoin.symbol} without limits.
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                onClick={() => {
                  if (flowKind === 'disable') onClose();
                  else if (flowKind === 'existing') setModalState('choose');
                  else setModalState('form');
                }}
              >
                {flowKind === 'disable' ? 'Cancel' : 'Back'}
              </Button>
              <Button
                className={`flex-1 h-11 rounded-xl font-semibold text-white ${primaryBtnClass}`}
                onClick={
                  flowKind === 'disable'
                    ? handleDisable
                    : flowKind === 'existing'
                      ? handleLinkExisting
                      : handleCreate
                }
              >
                {flowKind === 'disable'
                  ? 'Remove Restrictions'
                  : flowKind === 'existing'
                    ? `Apply to ${selectedCoin.symbol}`
                    : 'Create List'}
              </Button>
            </div>
          </>
        )}

        {/* ═══ CREATING STATE ═══ */}
        {modalState === 'creating' && (
          <>
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">
                Creating List...
              </DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                Step 1 of 2 — Processing transaction
              </DialogDescription>
            </div>
            <div className="px-6 pb-6 flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 text-coral animate-spin" />
              <p className="text-[13px] text-[#9B9590] mt-4 text-center">
                Creating your {isAllowedList ? 'allowed' : 'blocked'} address list on-chain...
              </p>
            </div>
          </>
        )}

        {/* ═══ CREATED STATE (explicit click for step 2) ═══ */}
        {modalState === 'created' && createdPolicyId && (
          <>
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">List Created</DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                Step 1 complete — Now apply it to {selectedCoin.symbol}
              </DialogDescription>
            </div>

            <div className="px-6 pb-4">
              <div className="bg-[#FDFBF8] rounded-xl p-3 border border-[#EDE9E3] mb-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[var(--color-sage)]/15 flex items-center justify-center">
                      <Check className="h-3 w-3 text-[var(--color-sage)]" />
                    </div>
                    <span className="text-[12px] text-[var(--color-sage)] font-medium">
                      List created
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-coral/10 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-coral">2</span>
                    </div>
                    <span className="text-[12px] text-[#2D3436]">
                      Apply to {selectedCoin.symbol}
                    </span>
                  </div>
                </div>
              </div>

              <div
                className={`rounded-xl p-4 border ${isAllowedList ? 'bg-[var(--color-sage)]/10 border-[var(--color-sage)]/20' : 'bg-coral/5 border-coral/20'}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${isAllowedList ? 'bg-[var(--color-sage)]/15' : 'bg-coral/10'}`}
                  >
                    {isAllowedList ? (
                      <ShieldCheck className="h-5 w-5 text-[var(--color-sage)]" />
                    ) : (
                      <ShieldX className="h-5 w-5 text-coral" />
                    )}
                  </div>
                  <div>
                    <p
                      className={`text-[13px] font-semibold ${isAllowedList ? 'text-[var(--color-sage)]' : 'text-coral'}`}
                    >
                      {isAllowedList ? 'Allowed List' : 'Blocked List'} Ready
                    </p>
                    <p className="text-[11px] text-[#9B9590]">
                      Click below to apply this to {selectedCoin.symbol}
                    </p>
                  </div>
                </div>
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
                className={`flex-1 h-11 rounded-xl font-semibold text-white ${primaryBtnClass}`}
                onClick={handleLinkCreated}
              >
                Apply to {selectedCoin.symbol}
              </Button>
            </div>
          </>
        )}

        {/* ═══ LINKING STATE ═══ */}
        {modalState === 'linking' && (
          <>
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">
                {flowKind === 'disable' ? 'Removing Restrictions...' : 'Applying Restrictions...'}
              </DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                {flowKind === 'create'
                  ? 'Step 2 of 2 — Processing transaction'
                  : 'Processing transaction'}
              </DialogDescription>
            </div>
            <div className="px-6 pb-6 flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 text-coral animate-spin" />
              <p className="text-[13px] text-[#9B9590] mt-4 text-center">
                {flowKind === 'disable'
                  ? `Removing restrictions from ${selectedCoin.symbol}...`
                  : `Applying restrictions to ${selectedCoin.symbol}...`}
              </p>
            </div>
          </>
        )}

        {/* ═══ SUCCESS STATE ═══ */}
        {modalState === 'success' && (
          <>
            <DialogTitle className="sr-only">Restrictions Updated!</DialogTitle>
            <DialogDescription className="sr-only">
              Transfer restrictions applied successfully
            </DialogDescription>
            <div className="px-6 pt-10 pb-6 text-center">
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
              <p className="text-[15px] font-bold text-[#2D3436] mb-1">
                {flowKind === 'disable' ? 'Restrictions Removed!' : 'Restrictions Enabled!'}
              </p>
              <div className="mb-6">
                <span
                  className={`text-2xl font-bold ${flowKind === 'disable' ? 'text-[#2D3436]' : isAllowedList ? 'text-[var(--color-sage)]' : 'text-coral'}`}
                >
                  {getModeLabel(targetMode)}
                </span>
              </div>
              {linkTxHash && (
                <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3] text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                      Transaction
                    </span>
                    <span className="font-mono text-[12px] text-[#2D3436]">
                      {linkTxHash.slice(0, 10)}...{linkTxHash.slice(-4)}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              {linkTxHash && (
                <Button
                  variant="outline"
                  onClick={() => window.open(getExplorerTxUrl(linkTxHash), '_blank')}
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
