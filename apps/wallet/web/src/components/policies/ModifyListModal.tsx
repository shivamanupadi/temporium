import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, ExternalLink, ShieldCheck, ShieldX } from 'lucide-react';
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

interface ModifyListModalProps {
  isOpen: boolean;
  mode: 'add' | 'remove';
  policyType: PolicyType;
  policyId: bigint;
  onSuccess: () => void;
  onClose: () => void;
}

type ModalState = 'form' | 'success';

export function ModifyListModal({
  isOpen,
  mode,
  policyType,
  policyId,
  onSuccess,
  onClose,
}: ModifyListModalProps): ReactElement {
  const { modifyWhitelist, modifyBlacklist } = usePolicies();
  const { tokens } = useTokenList();

  const [address, setAddress] = useState('');
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [modalState, setModalState] = useState<ModalState>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string>('');
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setAddress('');
      setFeeToken(tokens[0] ?? null);
      setModalState('form');
      setIsSubmitting(false);
      setTxHash('');
    }
  }, [isOpen, tokens]);

  const isWhitelist = policyType === 'whitelist';

  const titleText = (() => {
    if (mode === 'add') {
      return isWhitelist ? 'Add to Whitelist' : 'Add to Blacklist';
    }
    return isWhitelist ? 'Remove from Whitelist' : 'Remove from Blacklist';
  })();

  const descriptionText = (() => {
    if (mode === 'add') {
      return isWhitelist
        ? 'Allow an address to transfer tokens'
        : 'Block an address from transferring tokens';
    }
    return isWhitelist
      ? 'Remove an address from the allowed list'
      : 'Unblock an address from the restricted list';
  })();

  const successTitle = (() => {
    if (mode === 'add') {
      return isWhitelist ? 'Added to Whitelist' : 'Added to Blacklist';
    }
    return isWhitelist ? 'Removed from Whitelist' : 'Removed from Blacklist';
  })();

  const handleSubmit = useCallback(async (): Promise<void> => {
    const trimmed = address.trim();

    if (!trimmed) {
      toast.error('Please enter an address');
      return;
    }

    if (!isAddress(trimmed)) {
      toast.error('Invalid address format');
      return;
    }

    setIsSubmitting(true);
    isSubmittingRef.current = true;
    try {
      let result: { receipt: { transactionHash: string } };

      if (isWhitelist) {
        result = await modifyWhitelist({
          policyId,
          address: trimmed as Address,
          allowed: mode === 'add',
          feeToken: feeToken?.address,
        });
      } else {
        result = await modifyBlacklist({
          policyId,
          address: trimmed as Address,
          restricted: mode === 'add',
          feeToken: feeToken?.address,
        });
      }

      setTxHash(result.receipt.transactionHash);
      setModalState('success');
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to modify policy';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [address, policyId, mode, feeToken, modifyWhitelist, modifyBlacklist, isWhitelist, onSuccess]);

  const handleClose = useCallback((): void => {
    if (!isSubmitting && !isSubmittingRef.current) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  const actionColor =
    mode === 'remove'
      ? 'bg-coral hover:bg-coral/80'
      : isWhitelist
        ? 'bg-[var(--color-sage)] hover:bg-[var(--color-sage)]/80'
        : 'bg-coral hover:bg-coral/80';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px] p-0 gap-0 rounded-2xl">
        {/* FORM STATE */}
        {modalState === 'form' && (
          <>
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">{titleText}</DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                {descriptionText}
              </DialogDescription>
            </div>

            <div className="px-6 pb-4">
              <ContactPicker value={address} onChange={setAddress} label="Address" />
            </div>

            {feeToken && tokens.length > 0 && (
              <div className="px-6 pb-4">
                <FeeTokenPicker value={feeToken} tokens={tokens} onChange={setFeeToken} />
              </div>
            )}

            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-10 rounded-xl text-[13px] border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                className={`flex-1 h-10 rounded-xl text-[13px] font-semibold text-white ${actionColor}`}
                onClick={handleSubmit}
                disabled={isSubmitting || !address.trim()}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                {isSubmitting
                  ? mode === 'add'
                    ? 'Adding...'
                    : 'Removing...'
                  : mode === 'add'
                    ? 'Add'
                    : 'Remove'}
              </Button>
            </div>
          </>
        )}

        {/* SUCCESS STATE */}
        {modalState === 'success' && (
          <>
            <DialogTitle className="sr-only">{successTitle}!</DialogTitle>
            <DialogDescription className="sr-only">
              Transaction completed successfully
            </DialogDescription>

            <div className="px-6 pt-10 pb-6 text-center">
              {/* Success icon */}
              <div className="inline-flex items-center justify-center mb-5">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isWhitelist ? 'bg-[var(--color-sage)]/10' : 'bg-coral/8'}`}
                >
                  {isWhitelist ? (
                    <ShieldCheck className="h-7 w-7 text-[var(--color-sage)]" />
                  ) : (
                    <ShieldX className="h-7 w-7 text-coral" />
                  )}
                </div>
              </div>

              {/* Title */}
              <p className="text-[15px] font-bold text-[#2D3436] mb-1">{successTitle}!</p>

              {/* Hero value */}
              <p className="text-[13px] font-mono text-[#6B6560] mb-5">
                {formatAddress(address.trim(), 8)}
              </p>

              {/* Details card */}
              <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3] text-left">
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-wider">
                    Policy
                  </span>
                  <span
                    className={`text-[13px] font-medium ${isWhitelist ? 'text-[var(--color-sage)]' : 'text-coral'}`}
                  >
                    {isWhitelist ? 'Whitelist' : 'Blacklist'} #{policyId.toString()}
                  </span>
                </div>
                {txHash && (
                  <>
                    <div className="h-px bg-[#EDE9E3]/50 my-1" />
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-wider">
                        Transaction
                      </span>
                      <span className="font-mono text-[12px] text-[#2D3436]">
                        {txHash.slice(0, 10)}...{txHash.slice(-4)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              {txHash && (
                <Button
                  variant="outline"
                  onClick={() => window.open(getExplorerTxUrl(txHash), '_blank')}
                  className="flex-1 h-10 rounded-xl text-[13px] border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Explorer
                </Button>
              )}
              <Button
                className={`flex-1 h-10 rounded-xl text-[13px] font-semibold text-white ${isWhitelist ? 'bg-[var(--color-sage)] hover:bg-[var(--color-sage)]/80' : 'bg-coral hover:bg-coral/80'}`}
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
