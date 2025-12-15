import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, UserPlus, UserMinus, Check, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { isAddress } from 'viem';
import { Button } from '@/components/ui/button';
import { FeeTokenSelector } from '@/components/FeeTokenSelector';
import { AddressInput } from '@/components/AddressInput';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { usePolicies } from '@/hooks/usePolicies';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { formatAddress } from '@/lib/utils';
import type { Token } from '@/lib/tokenlist';
import type { PolicyType } from '@/types';
import type { Address } from 'viem';

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

  const [address, setAddress] = useState('');
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [modalState, setModalState] = useState<ModalState>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string>('');
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setAddress('');
      setModalState('form');
      setIsSubmitting(false);
      setTxHash('');
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!address || !isAddress(address)) {
      toast.error('Please enter a valid address');
      return;
    }

    setIsSubmitting(true);
    isSubmittingRef.current = true;
    try {
      let result;
      if (policyType === 'whitelist') {
        result = await modifyWhitelist({
          policyId,
          address: address as Address,
          allowed: mode === 'add',
          feeToken: feeToken?.address,
        });
      } else {
        result = await modifyBlacklist({
          policyId,
          address: address as Address,
          restricted: mode === 'add',
          feeToken: feeToken?.address,
        });
      }

      setTxHash(result.receipt.transactionHash);
      setModalState('success');
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to modify list';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [address, policyId, policyType, mode, feeToken, modifyWhitelist, modifyBlacklist, onSuccess]);

  const handleClose = useCallback((): void => {
    if (!isSubmitting && !isSubmittingRef.current) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  const isWhitelist = policyType === 'whitelist';
  const isAdding = mode === 'add';

  const getTitle = (): string => {
    if (isWhitelist) {
      return isAdding ? 'Add to Whitelist' : 'Remove from Whitelist';
    }
    return isAdding ? 'Add to Blacklist' : 'Remove from Blacklist';
  };

  const getDescription = (): string => {
    if (isWhitelist) {
      return isAdding
        ? 'This address will be allowed to transact with tokens using this policy'
        : 'This address will no longer be allowed to transact';
    }
    return isAdding
      ? 'This address will be blocked from transacting with tokens using this policy'
      : 'This address will no longer be blocked';
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden rounded-2xl">
        {/* FORM STATE */}
        {modalState === 'form' && (
          <>
            <div className="px-6 pt-6 pb-4">
              <DialogTitle className="text-lg font-semibold">{getTitle()}</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {getDescription()}
              </DialogDescription>
            </div>

            <div className="px-6 pb-6">
              <div className="space-y-4">
                <AddressInput
                  label="Address"
                  value={address}
                  onChange={setAddress}
                  placeholder="0x..."
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
                  onClick={handleSubmit}
                  disabled={!address || !isAddress(address) || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing
                    </>
                  ) : (
                    <>
                      {isAdding ? (
                        <UserPlus className="h-4 w-4" />
                      ) : (
                        <UserMinus className="h-4 w-4" />
                      )}
                      {isAdding ? 'Add' : 'Remove'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* SUCCESS STATE */}
        {modalState === 'success' && (
          <div className="p-5">
            <DialogTitle className="text-[15px] font-semibold mb-4">
              {isAdding ? 'Address Added!' : 'Address Removed!'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {isAdding ? 'Address added to list' : 'Address removed from list'}
            </DialogDescription>

            <div className="text-center pt-4">
              {/* Success icon */}
              <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-6">
                <Check className="h-7 w-7 text-white" />
              </div>

              {/* Success text */}
              <p className="text-foreground text-sm font-semibold mb-1">
                {isAdding ? 'Added to' : 'Removed from'} {isWhitelist ? 'Whitelist' : 'Blacklist'}
              </p>

              {/* Address */}
              <div className="mb-6">
                <span className="text-lg font-mono text-foreground">
                  {formatAddress(address, 8)}
                </span>
              </div>

              {/* Details card */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-3 text-left mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Policy ID</span>
                  <span className="font-mono text-xs text-foreground">{policyId.toString()}</span>
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
