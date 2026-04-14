import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, ExternalLink, ShieldCheck, ShieldX, UserPlus, UserMinus } from 'lucide-react';
import { toast } from '@/lib/toast';
import { isAddress, type Address } from 'viem';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@temporium/shared-ui';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import { ContactPicker } from '@/components/ContactPicker';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { formatAddress } from '@/lib/utils';
import { usePolicies } from '@/hooks/usePolicies';
import { useTokenList } from '@/hooks/useTokenList';
import type { Token } from '@/lib/tokenlist';

interface ManageAddressModalProps {
  isOpen: boolean;
  mode: 'add' | 'remove' | 'check';
  restrictionMode: 'allowed-list' | 'blocked-list';
  policyId: bigint;
  onSuccess: () => void;
  onClose: () => void;
}

type ModalState = 'form' | 'success' | 'result';

export function ManageAddressModal({
  isOpen,
  mode,
  restrictionMode,
  policyId,
  onSuccess,
  onClose,
}: ManageAddressModalProps): ReactElement {
  const { address: walletAddress } = useAccount();
  const { modifyWhitelist, modifyBlacklist, checkAuthorization } = usePolicies();
  const { tokens } = useTokenList();

  const [address, setAddress] = useState('');
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [modalState, setModalState] = useState<ModalState>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string>('');
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setAddress('');
      setFeeToken(tokens[0] ?? null);
      setModalState('form');
      setIsSubmitting(false);
      setTxHash('');
      setIsAuthorized(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const isAllowedList = restrictionMode === 'allowed-list';

  const titleText = (() => {
    if (mode === 'check') return 'Check Address';
    if (mode === 'add') return isAllowedList ? 'Add Allowed Address' : 'Block Address';
    return isAllowedList ? 'Remove Allowed Address' : 'Unblock Address';
  })();

  const descriptionText = (() => {
    if (mode === 'check') return 'Check if an address can transfer this token';
    if (mode === 'add') {
      return isAllowedList
        ? 'Allow this address to transfer tokens'
        : 'Prevent this address from transferring tokens';
    }
    return isAllowedList
      ? 'Revoke transfer permission for this address'
      : 'Allow this address to transfer again';
  })();

  const successTitle = (() => {
    if (mode === 'add') return isAllowedList ? 'Address Added!' : 'Address Blocked!';
    return isAllowedList ? 'Address Removed!' : 'Address Unblocked!';
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
      if (mode === 'check') {
        const authorized = await checkAuthorization({ policyId, user: trimmed as Address });
        setIsAuthorized(authorized);
        setModalState('result');
      } else {
        let result: { receipt: { transactionHash: string } };
        if (isAllowedList) {
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
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Operation failed';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [
    address,
    policyId,
    mode,
    feeToken,
    modifyWhitelist,
    modifyBlacklist,
    checkAuthorization,
    isAllowedList,
    onSuccess,
  ]);

  const handleClose = useCallback((): void => {
    if (!isSubmitting && !isSubmittingRef.current) onClose();
  }, [isSubmitting, onClose]);

  const actionColor = (() => {
    if (mode === 'check')
      return isAllowedList
        ? 'bg-[var(--color-sage)] hover:bg-[var(--color-sage)]/80'
        : 'bg-coral hover:bg-coral/80';
    if (mode === 'remove') return 'bg-coral hover:bg-coral/80';
    return isAllowedList
      ? 'bg-[var(--color-sage)] hover:bg-[var(--color-sage)]/80'
      : 'bg-coral hover:bg-coral/80';
  })();

  const buttonLabel = (() => {
    if (isSubmitting)
      return mode === 'check' ? 'Checking...' : mode === 'add' ? 'Adding...' : 'Removing...';
    if (mode === 'check') return 'Check';
    if (mode === 'add') return isAllowedList ? 'Add Address' : 'Block Address';
    return isAllowedList ? 'Remove Address' : 'Unblock Address';
  })();

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
              <ContactPicker
                value={address}
                onChange={setAddress}
                label="Address"
                selfAddress={walletAddress}
              />
            </div>
            {mode !== 'check' && feeToken && tokens.length > 0 && (
              <div className="px-6 pb-4 flex items-center justify-between">
                <span className="text-[12px] text-[#9B9590]">Gas paid in</span>
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
                {buttonLabel}
              </Button>
            </div>
          </>
        )}

        {/* SUCCESS STATE (add/remove) */}
        {modalState === 'success' && (
          <>
            <DialogTitle className="sr-only">{successTitle}</DialogTitle>
            <DialogDescription className="sr-only">
              Transaction completed successfully
            </DialogDescription>
            <div className="px-6 pt-10 pb-6 text-center">
              <div className="inline-flex items-center justify-center mb-5">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isAllowedList ? 'bg-[var(--color-sage)]/10' : 'bg-coral/8'}`}
                >
                  {mode === 'add' ? (
                    <UserPlus
                      className={`h-7 w-7 ${isAllowedList ? 'text-[var(--color-sage)]' : 'text-coral'}`}
                    />
                  ) : (
                    <UserMinus
                      className={`h-7 w-7 ${isAllowedList ? 'text-[var(--color-sage)]' : 'text-coral'}`}
                    />
                  )}
                </div>
              </div>
              <p className="text-[15px] font-bold text-[#2D3436] mb-1">{successTitle}</p>
              <p className="text-[13px] font-mono text-[#6B6560] mb-5">
                {formatAddress(address.trim(), 8)}
              </p>
              {txHash && (
                <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3] text-left">
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-wider">
                      Transaction
                    </span>
                    <span className="font-mono text-[12px] text-[#2D3436]">
                      {txHash.slice(0, 10)}...{txHash.slice(-4)}
                    </span>
                  </div>
                </div>
              )}
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
                className={`flex-1 h-10 rounded-xl text-[13px] font-semibold text-white ${isAllowedList ? 'bg-[var(--color-sage)] hover:bg-[var(--color-sage)]/80' : 'bg-coral hover:bg-coral/80'}`}
                onClick={onClose}
              >
                Done
              </Button>
            </div>
          </>
        )}

        {/* RESULT STATE (check) */}
        {modalState === 'result' && isAuthorized !== null && (
          <>
            <DialogTitle className="sr-only">
              {isAuthorized ? 'Can Transfer' : 'Cannot Transfer'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Address authorization check result
            </DialogDescription>
            <div className="px-6 pt-10 pb-6 text-center">
              <div className="inline-flex items-center justify-center mb-6">
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center ${isAuthorized ? 'bg-[var(--color-sage)]' : 'bg-coral'}`}
                >
                  {isAuthorized ? (
                    <ShieldCheck className="w-8 h-8 text-white" />
                  ) : (
                    <ShieldX className="w-8 h-8 text-white" />
                  )}
                </div>
              </div>
              <p className="text-[15px] font-bold text-[#2D3436] mb-1">
                {isAuthorized ? 'Can Transfer' : 'Cannot Transfer'}
              </p>
              <p className="text-[13px] font-light text-[#9B9590] mb-6 px-4">
                {isAuthorized
                  ? 'This address is authorized to transfer this token.'
                  : isAllowedList
                    ? 'This address is not on the allowed list and cannot transfer.'
                    : 'This address is blocked and cannot transfer.'}
              </p>
              <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3] space-y-3 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    Address
                  </span>
                  <span className="text-[13px] font-medium text-[#2D3436] font-mono">
                    {formatAddress(address.trim(), 8)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    Status
                  </span>
                  <span
                    className={`text-[13px] font-medium ${isAuthorized ? 'text-[var(--color-sage)]' : 'text-coral'}`}
                  >
                    {isAuthorized ? 'Authorized' : 'Not Authorized'}
                  </span>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                onClick={() => {
                  setAddress('');
                  setIsAuthorized(null);
                  setModalState('form');
                }}
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
