import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactElement,
  type ChangeEvent,
} from 'react';
import { Loader2, ShieldCheck, ShieldX } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { FeeTokenSelector } from '@/components/FeeTokenSelector';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePolicies } from '@/hooks/usePolicies';
import type { Token } from '@/lib/tokenlist';
import type { PolicyType } from '@/types';
import type { Address } from 'viem';
import { isAddress } from 'viem';

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

  const [policyType, setPolicyType] = useState<PolicyType>('whitelist');
  const [addresses, setAddresses] = useState('');
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [modalState, setModalState] = useState<ModalState>('form');
  const [isCreating, setIsCreating] = useState(false);
  const isCreatingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setPolicyType('whitelist');
      setAddresses('');
      setModalState('form');
      setIsCreating(false);
    }
  }, [isOpen]);

  const parseAddresses = useCallback((): Address[] => {
    if (!addresses.trim()) return [];
    return addresses
      .split(/[\n,]/)
      .map(addr => addr.trim())
      .filter(addr => addr && isAddress(addr)) as Address[];
  }, [addresses]);

  const handleReview = useCallback((): void => {
    setModalState('confirm');
  }, []);

  const handleSubmit = useCallback(async (): Promise<void> => {
    setIsCreating(true);
    isCreatingRef.current = true;
    try {
      const parsedAddresses = parseAddresses();
      const result = await createPolicy({
        type: policyType,
        addresses: parsedAddresses.length > 0 ? parsedAddresses : undefined,
        feeToken: feeToken?.address,
      });

      // Fire confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        ticks: 50,
        gravity: 3,
        decay: 0.9,
        scalar: 0.8,
      });

      toast.success(`Policy #${result.policy.policyId} created!`);
      onSuccess();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create policy';
      toast.error(message);
    } finally {
      setIsCreating(false);
      isCreatingRef.current = false;
    }
  }, [policyType, parseAddresses, feeToken, createPolicy, onSuccess, onClose]);

  const handleClose = useCallback((): void => {
    if (!isCreating && !isCreatingRef.current) {
      onClose();
    }
  }, [isCreating, onClose]);

  const parsedAddresses = parseAddresses();
  const isWhitelist = policyType === 'whitelist';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden rounded-2xl">
        {/* FORM STATE */}
        {modalState === 'form' && (
          <>
            <div className="px-6 pt-6 pb-4">
              <DialogTitle className="text-lg font-semibold">Create TIP403 Policy</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Create a new access control policy
              </DialogDescription>
            </div>

            <div className="px-6 pb-6">
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Policy Type
                  </label>
                  <Select value={policyType} onValueChange={v => setPolicyType(v as PolicyType)}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whitelist">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-emerald-600" />
                          <span>Whitelist</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="blacklist">
                        <div className="flex items-center gap-2">
                          <ShieldX className="h-4 w-4 text-rose-600" />
                          <span>Blacklist</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {isWhitelist
                      ? 'Only listed addresses can transact'
                      : 'Listed addresses will be blocked'}
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Initial Addresses (Optional)
                  </label>
                  <textarea
                    placeholder={'0x1234...\n0x5678...'}
                    value={addresses}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setAddresses(e.target.value)}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Enter addresses separated by commas or new lines
                  </p>
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
                <Button className="flex-1" onClick={handleReview}>
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
              <DialogTitle className="text-lg font-semibold">Confirm Creation</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Review the details before creating
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
                    <p className="text-xs text-muted-foreground">Policy Type</p>
                    <p
                      className={`text-lg font-semibold ${isWhitelist ? 'text-emerald-700' : 'text-rose-700'}`}
                    >
                      {isWhitelist ? 'Whitelist' : 'Blacklist'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Details Card */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Initial Addresses</span>
                  <span className="text-xs font-medium text-foreground">
                    {parsedAddresses.length}
                  </span>
                </div>
                {feeToken && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Fee Token</span>
                    <span className="text-xs font-medium text-foreground">{feeToken.symbol}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setModalState('form')}
                disabled={isCreating}
              >
                Back
              </Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating
                  </>
                ) : (
                  'Create'
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
