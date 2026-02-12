import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, ShieldCheck, ShieldX, Plus } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { isAddress, type Address } from 'viem';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@temporium/shared-ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import { usePolicies } from '@/hooks/usePolicies';
import { useTokenList } from '@/hooks/useTokenList';
import type { Token } from '@/lib/tokenlist';
import type { PolicyType } from '@/types';

interface CreatePolicyModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

type ModalState = 'form' | 'confirm';

export function CreatePolicyModal({
  isOpen,
  onSuccess,
  onClose,
}: CreatePolicyModalProps): ReactElement {
  const { createPolicy } = usePolicies();
  const { tokens } = useTokenList();

  const [policyType, setPolicyType] = useState<PolicyType>('whitelist');
  const [addressesInput, setAddressesInput] = useState('');
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [modalState, setModalState] = useState<ModalState>('form');
  const [isCreating, setIsCreating] = useState(false);
  const isCreatingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setPolicyType('whitelist');
      setAddressesInput('');
      setFeeToken(tokens[0] ?? null);
      setModalState('form');
      setIsCreating(false);
    }
  }, [isOpen, tokens]);

  const parsedAddresses = useCallback((): Address[] => {
    if (!addressesInput.trim()) return [];
    return addressesInput
      .split(/[,\n]+/)
      .map(a => a.trim())
      .filter(a => a.length > 0 && isAddress(a)) as Address[];
  }, [addressesInput]);

  const handleReview = useCallback((): void => {
    const raw = addressesInput.trim();
    if (raw) {
      const entries = raw.split(/[,\n]+/).map(a => a.trim()).filter(a => a.length > 0);
      const invalid = entries.filter(a => !isAddress(a));
      if (invalid.length > 0) {
        toast.error(`Invalid address${invalid.length > 1 ? 'es' : ''}: ${invalid.slice(0, 3).join(', ')}${invalid.length > 3 ? '...' : ''}`);
        return;
      }
    }
    setModalState('confirm');
  }, [addressesInput]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    setIsCreating(true);
    isCreatingRef.current = true;
    try {
      const addresses = parsedAddresses();
      await createPolicy({
        type: policyType,
        addresses: addresses.length > 0 ? addresses : undefined,
        feeToken: feeToken?.address,
      });

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        ticks: 50,
        gravity: 3,
        decay: 0.9,
        scalar: 0.8,
      });

      toast.success(`${policyType === 'whitelist' ? 'Whitelist' : 'Blacklist'} policy created!`);
      onSuccess();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create policy';
      toast.error(message);
    } finally {
      setIsCreating(false);
      isCreatingRef.current = false;
    }
  }, [policyType, parsedAddresses, feeToken, createPolicy, onSuccess, onClose]);

  const handleClose = useCallback((): void => {
    if (!isCreating && !isCreatingRef.current) {
      onClose();
    }
  }, [isCreating, onClose]);

  const isWhitelist = policyType === 'whitelist';
  const addresses = parsedAddresses();

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px] p-0 gap-0 rounded-2xl">
        {modalState === 'form' && (
          <>
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">
                Create Policy
              </DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                Configure a new TIP403 transfer policy
              </DialogDescription>
            </div>

            <div className="px-6 pb-4">
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block">
                    Policy Type
                  </label>
                  <Select value={policyType} onValueChange={v => setPolicyType(v as PolicyType)}>
                    <SelectTrigger className="w-full !h-[46px] px-4 rounded-xl border-[#EDE9E3] bg-[#FDFBF8] text-[14px] text-[#2D3436] shadow-none focus:border-lavender/40 transition-colors">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whitelist">
                        <span className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-[var(--color-sage)]" />
                          Whitelist
                        </span>
                      </SelectItem>
                      <SelectItem value="blacklist">
                        <span className="flex items-center gap-2">
                          <ShieldX className="h-4 w-4 text-coral" />
                          Blacklist
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block">
                    Initial Addresses (optional)
                  </label>
                  <textarea
                    placeholder="0x..., 0x... or one per line"
                    value={addressesInput}
                    onChange={e => setAddressesInput(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] text-[14px] text-[#2D3436] font-mono placeholder:text-[#B5B0AA] focus:border-lavender/40 focus:outline-none transition-colors resize-none"
                  />
                </div>
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
              >
                Review
              </Button>
            </div>
          </>
        )}

        {modalState === 'confirm' && (
          <>
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">
                Confirm Policy
              </DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                Review the details before creating
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
                    <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">Type</p>
                    <p className={`text-lg font-semibold ${isWhitelist ? 'text-[var(--color-sage)]' : 'text-coral'}`}>
                      {isWhitelist ? 'Whitelist' : 'Blacklist'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Detail Card */}
              <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    Initial Addresses
                  </span>
                  <span className="text-[13px] font-medium text-[#2D3436]">
                    {addresses.length}
                  </span>
                </div>
                {feeToken && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                      Fee Token
                    </span>
                    <span className="text-[13px] font-medium text-[#2D3436]">{feeToken.symbol}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                onClick={() => setModalState('form')}
                disabled={isCreating}
              >
                Back
              </Button>
              <Button
                className={`flex-1 h-11 rounded-xl font-semibold text-white ${isWhitelist ? 'bg-[var(--color-sage)] hover:bg-[var(--color-sage)]/80' : 'bg-coral hover:bg-coral/80'}`}
                onClick={handleSubmit}
                disabled={isCreating}
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <Plus className="w-4 h-4 mr-1.5" />
                )}
                {isCreating ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
