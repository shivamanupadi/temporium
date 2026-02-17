import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactElement,
  type ChangeEvent,
} from 'react';
import { Loader2, ShieldCheck, ShieldX, ExternalLink } from 'lucide-react';
import { toast } from '@/lib/toast';
import confetti from 'canvas-confetti';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@temporium/shared-ui';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWalletClient } from 'wagmi';
import { Actions, getExplorerTxUrl } from '@/lib/tempo-client';
import { DEFAULT_FEE_TOKEN_ADDRESS } from '@/lib/constants';
import { useTokenList } from '@/hooks/useTokenList';
import type { Token } from '@/lib/tokenlist';
import type { StablecoinWithMetadata, PolicyType } from '@/types';
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
  const { data: walletClient } = useWalletClient();
  const { tokens } = useTokenList();

  const [policyType, setPolicyType] = useState<PolicyType>('whitelist');
  const [addresses, setAddresses] = useState('');
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [modalState, setModalState] = useState<ModalState>('form');
  const [createdPolicyId, setCreatedPolicyId] = useState<bigint | null>(null);
  const [txHash, setTxHash] = useState<string>('');
  const isProcessingRef = useRef(false);

  // Reset form only when modal opens (not when tokens refetch)
  useEffect(() => {
    if (isOpen) {
      setPolicyType('whitelist');
      setAddresses('');
      setFeeToken(tokens[0] ?? null);
      setModalState('form');
      setCreatedPolicyId(null);
      setTxHash('');
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

  const handleReview = useCallback((): void => {
    setModalState('confirm');
  }, []);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!walletClient) {
      toast.error('Wallet not connected');
      return;
    }

    isProcessingRef.current = true;
    setModalState('creating');

    try {
      // Step 1: Create policy
      const parsedAddresses = parseAddresses();
      const createResult = await Actions.policy.createSync(walletClient, {
        type: policyType,
        addresses: parsedAddresses.length > 0 ? parsedAddresses : undefined,
        feeToken: feeToken?.address ?? DEFAULT_FEE_TOKEN_ADDRESS,
      });

      const policyId = createResult.policyId;
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
  }, [policyType, parseAddresses, feeToken, walletClient, onLink, onSuccess]);

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
      <DialogContent className="sm:max-w-[400px] p-0 gap-0 rounded-2xl">
        {/* FORM STATE */}
        {modalState === 'form' && (
          <>
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">
                Create & Link Policy
              </DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                Create a new TIP403 policy and link it to {selectedCoin.symbol}
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
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-[var(--color-sage)]" />
                          <span>Whitelist</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="blacklist">
                        <div className="flex items-center gap-2">
                          <ShieldX className="h-4 w-4 text-coral" />
                          <span>Blacklist</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-[#9B9590] mt-1">
                    {isWhitelist
                      ? 'Only listed addresses can transfer tokens'
                      : 'Listed addresses will be blocked from transfers'}
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block">
                    Initial Addresses (Optional)
                  </label>
                  <textarea
                    placeholder={'0x1234...\n0x5678...'}
                    value={addresses}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setAddresses(e.target.value)}
                    className="w-full min-h-[80px] px-4 py-3 rounded-xl border border-[#EDE9E3] bg-[#FDFBF8] text-[13px] text-[#2D3436] font-mono placeholder:text-[#B5B0AA] focus:border-lavender/40 focus:outline-none transition-colors resize-none"
                  />
                  <p className="text-[11px] text-[#9B9590] mt-1">
                    Enter addresses separated by commas or new lines
                  </p>
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
                className="flex-1 h-11 rounded-xl font-semibold bg-lavender hover:bg-lavender/80 text-white"
                onClick={handleReview}
              >
                Continue
              </Button>
            </div>
          </>
        )}

        {/* CONFIRM STATE */}
        {modalState === 'confirm' && (
          <>
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">
                Confirm Creation
              </DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                Review the details before creating and linking
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
                      Policy Type
                    </p>
                    <p
                      className={`text-lg font-semibold ${isWhitelist ? 'text-[var(--color-sage)]' : 'text-coral'}`}
                    >
                      {isWhitelist ? 'Whitelist' : 'Blacklist'}
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
                    Initial Addresses
                  </span>
                  <span className="text-[13px] font-medium text-[#2D3436]">
                    {parsedAddresses.length}
                  </span>
                </div>
              </div>

              {/* Warning box */}
              <div className="bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded-xl p-3 mt-3">
                <p className="text-xs text-[var(--color-warning)]">
                  This will create a new policy and immediately link it to {selectedCoin.symbol}.
                  You can manage the policy later from TIP403 Factory.
                </p>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                onClick={() => setModalState('form')}
              >
                Back
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl font-semibold bg-lavender hover:bg-lavender/80 text-white"
                onClick={handleSubmit}
              >
                Create & Link
              </Button>
            </div>
          </>
        )}

        {/* CREATING/LINKING STATE */}
        {isProcessing && (
          <>
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">
                {modalState === 'creating' ? 'Creating Policy...' : 'Linking Policy...'}
              </DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                Processing your transaction
              </DialogDescription>
            </div>

            <div className="px-6 pb-6 flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 text-lavender animate-spin" />
              <p className="text-[13px] text-[#9B9590] mt-4 text-center">
                {modalState === 'creating'
                  ? 'Creating your new policy on-chain...'
                  : `Linking policy to ${selectedCoin.symbol}...`}
              </p>
              {createdPolicyId && modalState === 'linking' && (
                <p className="text-[11px] text-[#9B9590] mt-2">
                  Policy #{createdPolicyId.toString()} created
                </p>
              )}
            </div>
          </>
        )}

        {/* SUCCESS STATE */}
        {modalState === 'success' && createdPolicyId && (
          <>
            <DialogTitle className="sr-only">Policy Created & Linked!</DialogTitle>
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
              <p className="text-[15px] font-bold text-[#2D3436] mb-1">Policy Created & Linked!</p>

              {/* Hero value */}
              <div className="mb-6">
                <span className="text-3xl font-bold text-[#2D3436]">
                  {isWhitelist ? 'Whitelist' : 'Blacklist'}
                </span>
                <span className="text-lg text-[#9B9590] ml-1.5 font-semibold">
                  #{createdPolicyId.toString()}
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
