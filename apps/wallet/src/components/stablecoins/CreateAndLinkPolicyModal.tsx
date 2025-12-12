import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactElement,
  type ChangeEvent,
} from 'react';
import { Loader2, ShieldCheck, ShieldX, Check, ExternalLink } from 'lucide-react';
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
import { getExplorerTxUrl } from '@/lib/tempo-client';
import type { Token } from '@/lib/tokenlist';
import type { StablecoinWithMetadata } from '@/hooks/useStablecoins';
import type { PolicyType } from '@/types';
import type { Address } from 'viem';
import { isAddress } from 'viem';

interface CreateAndLinkPolicyModalProps {
  isOpen: boolean;
  selectedCoin: StablecoinWithMetadata | null;
  onLink: (params: {
    policyId: bigint;
    feeToken?: Address;
  }) => Promise<{ receipt: { transactionHash: string } }>;
  onSuccess: () => void;
  onClose: () => void;
}

type ModalState = 'form' | 'confirm' | 'creating' | 'linking' | 'success';

export function CreateAndLinkPolicyModal({
  isOpen,
  selectedCoin,
  onLink,
  onSuccess,
  onClose,
}: CreateAndLinkPolicyModalProps): ReactElement {
  const { createPolicy } = usePolicies();

  const [policyType, setPolicyType] = useState<PolicyType>('whitelist');
  const [addresses, setAddresses] = useState('');
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [modalState, setModalState] = useState<ModalState>('form');
  const [createdPolicyId, setCreatedPolicyId] = useState<bigint | null>(null);
  const [txHash, setTxHash] = useState<string>('');
  const isProcessingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setPolicyType('whitelist');
      setAddresses('');
      setFeeToken(null);
      setModalState('form');
      setCreatedPolicyId(null);
      setTxHash('');
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
    isProcessingRef.current = true;
    setModalState('creating');

    try {
      // Step 1: Create policy
      const parsedAddresses = parseAddresses();
      const createResult = await createPolicy({
        type: policyType,
        addresses: parsedAddresses.length > 0 ? parsedAddresses : undefined,
        feeToken: feeToken?.address,
      });

      const policyId = BigInt(createResult.policy.policyId);
      setCreatedPolicyId(policyId);

      // Step 2: Link policy to token
      setModalState('linking');
      const linkResult = await onLink({
        policyId,
        feeToken: feeToken?.address,
      });

      setTxHash(linkResult.receipt.transactionHash);
      setModalState('success');

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

      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create and link policy';
      toast.error(message);
      // Go back to confirm state on error
      setModalState('confirm');
    } finally {
      isProcessingRef.current = false;
    }
  }, [policyType, parseAddresses, feeToken, createPolicy, onLink, onSuccess]);

  const handleClose = useCallback((): void => {
    if (!isProcessingRef.current) {
      onClose();
    }
  }, [onClose]);

  if (!selectedCoin) return <></>;

  const parsedAddresses = parseAddresses();
  const isWhitelist = policyType === 'whitelist';
  const isProcessing = modalState === 'creating' || modalState === 'linking';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden rounded-2xl">
        {/* FORM STATE */}
        {modalState === 'form' && (
          <>
            <div className="px-6 pt-6 pb-4">
              <DialogTitle className="text-lg font-semibold">Create & Link Policy</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Create a new TIP403 policy and link it to {selectedCoin.symbol}
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
                      ? 'Only listed addresses can transfer tokens'
                      : 'Listed addresses will be blocked from transfers'}
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
              <DialogTitle className="text-lg font-semibold">Confirm Creation</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Review the details before creating and linking
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
                  <span className="text-xs text-muted-foreground">Token</span>
                  <span className="text-xs font-medium text-foreground">
                    {selectedCoin.name} ({selectedCoin.symbol})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Initial Addresses</span>
                  <span className="text-xs font-medium text-foreground">
                    {parsedAddresses.length}
                  </span>
                </div>
              </div>

              <div className="bg-amber-50 rounded-xl p-3 mt-4">
                <p className="text-xs text-amber-700">
                  This will create a new policy and immediately link it to {selectedCoin.symbol}.
                  You can manage the policy later from TIP403 Factory.
                </p>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setModalState('form')}>
                Back
              </Button>
              <Button className="flex-1" onClick={handleSubmit}>
                Create & Link
              </Button>
            </div>
          </>
        )}

        {/* CREATING/LINKING STATE */}
        {isProcessing && (
          <div className="p-6">
            <DialogTitle className="text-lg font-semibold mb-4">
              {modalState === 'creating' ? 'Creating Policy...' : 'Linking Policy...'}
            </DialogTitle>
            <DialogDescription className="sr-only">Processing transaction</DialogDescription>

            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground text-center">
                {modalState === 'creating'
                  ? 'Creating your new policy on-chain...'
                  : `Linking policy to ${selectedCoin.symbol}...`}
              </p>
              {createdPolicyId && modalState === 'linking' && (
                <p className="text-xs text-muted-foreground mt-2">
                  Policy #{createdPolicyId.toString()} created
                </p>
              )}
            </div>
          </div>
        )}

        {/* SUCCESS STATE */}
        {modalState === 'success' && createdPolicyId && (
          <div className="p-5">
            <DialogTitle className="text-[15px] font-semibold mb-4">
              Policy Created & Linked!
            </DialogTitle>
            <DialogDescription className="sr-only">
              Policy has been created and linked to the token
            </DialogDescription>

            <div className="text-center pt-4">
              {/* Success icon */}
              <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-6">
                <Check className="h-7 w-7 text-white" />
              </div>

              {/* Success text */}
              <p className="text-foreground text-sm font-semibold mb-1">
                {isWhitelist ? 'Whitelist' : 'Blacklist'} Policy #{createdPolicyId.toString()}
              </p>

              {/* Token name */}
              <div className="mb-6">
                <span className="text-muted-foreground text-sm">linked to </span>
                <span className="text-lg font-semibold text-foreground">{selectedCoin.symbol}</span>
              </div>

              {/* Details card */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-3 text-left mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Policy ID</span>
                  <span className="text-xs font-mono text-foreground">
                    {createdPolicyId.toString()}
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

              <p className="text-[11px] text-muted-foreground mb-4">
                You can manage this policy from TIP403 Factory
              </p>

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
