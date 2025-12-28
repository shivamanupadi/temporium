import { useState, useEffect, useCallback, type ReactElement } from 'react';
import { Loader2, Search, ShieldCheck, ShieldX } from 'lucide-react';
import { toast } from 'sonner';
import { isAddress } from 'viem';
import { Button } from '@/components/ui/button';
import { AddressInput } from '@/components/AddressInput';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { usePolicies } from '@/hooks/usePolicies';
import { formatAddress } from '@/lib/utils';
import type { PolicyType } from '@/types';
import type { Address } from 'viem';

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
  const [checkedAddress, setCheckedAddress] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAddress('');
      setModalState('form');
      setIsChecking(false);
      setIsAuthorized(null);
      setCheckedAddress('');
    }
  }, [isOpen]);

  const handleCheck = useCallback(async (): Promise<void> => {
    if (!address || !isAddress(address)) {
      toast.error('Please enter a valid address');
      return;
    }

    setIsChecking(true);
    try {
      const result = await checkAuthorization({
        policyId,
        user: address as Address,
      });

      setIsAuthorized(result);
      setCheckedAddress(address);
      setModalState('result');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to check authorization';
      toast.error(message);
    } finally {
      setIsChecking(false);
    }
  }, [address, policyId, checkAuthorization]);

  const handleCheckAnother = useCallback((): void => {
    setAddress('');
    setModalState('form');
    setIsAuthorized(null);
    setCheckedAddress('');
  }, []);

  const isWhitelist = policyType === 'whitelist';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden rounded-2xl">
        {/* FORM STATE */}
        {modalState === 'form' && (
          <>
            <div className="px-6 pt-6 pb-4">
              <DialogTitle className="text-lg font-semibold">Check Authorization</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Check if an address is authorized by this {isWhitelist ? 'whitelist' : 'blacklist'}{' '}
                policy
              </DialogDescription>
            </div>

            <div className="px-6 pb-6">
              <div className="space-y-4">
                <AddressInput
                  label="Address to Check"
                  value={address}
                  onChange={setAddress}
                  placeholder="0x..."
                />
              </div>

              <div className="flex gap-2 mt-6">
                <Button variant="outline" className="flex-1" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCheck}
                  disabled={!address || !isAddress(address) || isChecking}
                >
                  {isChecking ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Checking
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4" />
                      Check
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* RESULT STATE */}
        {modalState === 'result' && (
          <>
            <div className="px-6 pt-6 pb-4 text-center">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ${
                  isAuthorized ? 'bg-emerald-100' : 'bg-rose-100'
                }`}
              >
                {isAuthorized ? (
                  <ShieldCheck className="h-8 w-8 text-emerald-600" />
                ) : (
                  <ShieldX className="h-8 w-8 text-rose-600" />
                )}
              </div>
              <DialogTitle
                className={`text-lg font-semibold ${isAuthorized ? 'text-emerald-700' : 'text-rose-700'}`}
              >
                {isAuthorized ? 'Authorized' : 'Not Authorized'}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {isAuthorized
                  ? isWhitelist
                    ? 'This address is on the whitelist and can transact'
                    : 'This address is not on the blacklist and can transact'
                  : isWhitelist
                    ? 'This address is not on the whitelist and cannot transact'
                    : 'This address is on the blacklist and cannot transact'}
              </DialogDescription>
            </div>

            <div className="px-6 pb-6">
              <div className="bg-muted/50 rounded-xl p-4 mb-4">
                <p className="text-xs text-muted-foreground mb-1">Checked Address</p>
                <p className="text-sm font-mono text-foreground">
                  {formatAddress(checkedAddress, 12)}
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleCheckAnother}>
                  Check Another
                </Button>
                <Button className="flex-1" onClick={onClose}>
                  Done
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
