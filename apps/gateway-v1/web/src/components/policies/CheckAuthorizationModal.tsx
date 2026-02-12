import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, ShieldCheck, ShieldX } from 'lucide-react';
import { toast } from 'sonner';
import { isAddress, type Address } from 'viem';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@temporium/shared-ui';
import { ContactPicker } from '@/components/ContactPicker';
import { formatAddress } from '@/lib/utils';
import { usePolicies } from '@/hooks/usePolicies';
import type { PolicyType } from '@/types';

interface CheckAuthorizationModalProps {
  isOpen: boolean;
  policyId: bigint;
  policyType: PolicyType;
  onClose: () => void;
}

type ModalState = 'form' | 'result';

export function CheckAuthorizationModal({
  isOpen,
  policyId,
  policyType,
  onClose,
}: CheckAuthorizationModalProps): ReactElement {
  const { checkAuthorization } = usePolicies();

  const [address, setAddress] = useState('');
  const [modalState, setModalState] = useState<ModalState>('form');
  const [isChecking, setIsChecking] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setAddress('');
      setModalState('form');
      setIsChecking(false);
      setIsAuthorized(null);
    }
  }, [isOpen]);

  const isWhitelist = policyType === 'whitelist';

  const handleCheck = useCallback(async (): Promise<void> => {
    const trimmed = address.trim();

    if (!trimmed) {
      toast.error('Please enter an address');
      return;
    }

    if (!isAddress(trimmed)) {
      toast.error('Invalid address format');
      return;
    }

    setIsChecking(true);
    isCheckingRef.current = true;
    try {
      const authorized = await checkAuthorization({
        policyId,
        user: trimmed as Address,
      });

      setIsAuthorized(authorized);
      setModalState('result');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to check authorization';
      toast.error(message);
    } finally {
      setIsChecking(false);
      isCheckingRef.current = false;
    }
  }, [address, policyId, checkAuthorization]);

  const handleCheckAnother = useCallback((): void => {
    setAddress('');
    setIsAuthorized(null);
    setModalState('form');
  }, []);

  const handleClose = useCallback((): void => {
    if (!isChecking && !isCheckingRef.current) {
      onClose();
    }
  }, [isChecking, onClose]);

  const resultTitle = isAuthorized ? 'Authorized' : 'Not Authorized';
  const resultDescription = (() => {
    if (isAuthorized) {
      return isWhitelist
        ? 'This address is on the whitelist and can transfer tokens.'
        : 'This address is not on the blacklist and can transfer tokens.';
    }
    return isWhitelist
      ? 'This address is not on the whitelist and cannot transfer tokens.'
      : 'This address is on the blacklist and cannot transfer tokens.';
  })();

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px] p-0 gap-0 rounded-2xl">
        {/* FORM STATE */}
        {modalState === 'form' && (
          <>
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">
                Check Authorization
              </DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                Check if an address is authorized by this policy
              </DialogDescription>
            </div>

            <div className="px-6 pb-4">
              <ContactPicker
                value={address}
                onChange={setAddress}
                label="Address"
              />
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                onClick={onClose}
                disabled={isChecking}
              >
                Cancel
              </Button>
              <Button
                className={`flex-1 h-11 rounded-xl font-semibold text-white ${isWhitelist ? 'bg-[var(--color-sage)] hover:bg-[var(--color-sage)]/80' : 'bg-coral hover:bg-coral/80'}`}
                onClick={handleCheck}
                disabled={isChecking || !address.trim()}
              >
                {isChecking ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                {isChecking ? 'Checking...' : 'Check'}
              </Button>
            </div>
          </>
        )}

        {/* RESULT STATE */}
        {modalState === 'result' && isAuthorized !== null && (
          <>
            <DialogTitle className="sr-only">{resultTitle}</DialogTitle>
            <DialogDescription className="sr-only">{resultDescription}</DialogDescription>

            <div className="px-6 pt-10 pb-6 text-center">
              {/* Result icon */}
              <div className="inline-flex items-center justify-center mb-6">
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center ${
                    isAuthorized ? 'bg-[var(--color-sage)]' : 'bg-coral'
                  }`}
                >
                  {isAuthorized ? (
                    <ShieldCheck className="w-8 h-8 text-white" />
                  ) : (
                    <ShieldX className="w-8 h-8 text-white" />
                  )}
                </div>
              </div>

              {/* Title */}
              <p className="text-[15px] font-bold text-[#2D3436] mb-1">{resultTitle}</p>

              {/* Description */}
              <p className="text-[13px] font-light text-[#9B9590] mb-6 px-4">
                {resultDescription}
              </p>

              {/* Details card */}
              <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3] space-y-3 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">Address</span>
                  <span className="text-[13px] font-medium text-[#2D3436] font-mono">
                    {formatAddress(address.trim(), 8)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">Policy</span>
                  <span className={`text-[13px] font-medium ${isWhitelist ? 'text-[var(--color-sage)]' : 'text-coral'}`}>
                    {isWhitelist ? 'Whitelist' : 'Blacklist'} #{policyId.toString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">Status</span>
                  <span className={`text-[13px] font-medium ${isAuthorized ? 'text-[var(--color-sage)]' : 'text-coral'}`}>
                    {isAuthorized ? 'Authorized' : 'Not Authorized'}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                onClick={handleCheckAnother}
              >
                Check Another
              </Button>
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
