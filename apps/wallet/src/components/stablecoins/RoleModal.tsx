import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, Check, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { AddressInput } from '@/components/AddressInput';
import { FeeTokenSelector } from '@/components/FeeTokenSelector';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { ROLE_OPTIONS } from '@/lib/constants';
import { useStablecoins, type StablecoinWithMetadata } from '@/hooks/useStablecoins';
import type { TokenRole } from '@/types';
import type { Token } from '@/lib/tokenlist';

interface RoleModalProps {
  isOpen: boolean;
  mode: 'grant' | 'revoke';
  selectedCoin: StablecoinWithMetadata | null;
  onSuccess: () => void;
  onClose: () => void;
}

export function RoleModal({
  isOpen,
  mode,
  selectedCoin,
  onSuccess,
  onClose,
}: RoleModalProps): ReactElement {
  const { grantRoles, revokeRoles } = useStablecoins();

  const [roleAddress, setRoleAddress] = useState('');
  const [selectedRole, setSelectedRole] = useState<TokenRole>('issuer');
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  const isGrant = mode === 'grant';
  const title = isGrant ? 'Grant Role' : 'Revoke Role';
  const buttonLabel = isGrant ? 'Grant' : 'Revoke';

  useEffect(() => {
    if (isOpen) {
      setRoleAddress('');
      setSelectedRole('issuer');
      setTxHash(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!selectedCoin || !roleAddress) {
      toast.error('Please enter an address');
      return;
    }

    setIsSubmitting(true);
    isSubmittingRef.current = true;
    try {
      const result = isGrant
        ? await grantRoles({
            token: selectedCoin.address,
            to: roleAddress as `0x${string}`,
            roles: [selectedRole],
            feeToken: feeToken?.address,
          })
        : await revokeRoles({
            token: selectedCoin.address,
            from: roleAddress as `0x${string}`,
            roles: [selectedRole],
          });
      setTxHash(result.receipt.transactionHash);
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to ${mode} role`;
      toast.error(message);
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  }, [
    selectedCoin,
    roleAddress,
    selectedRole,
    feeToken,
    isGrant,
    grantRoles,
    revokeRoles,
    mode,
    onSuccess,
  ]);

  const handleClose = useCallback((): void => {
    if (!isSubmitting && !isSubmittingRef.current) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
        <div className="p-5">
          <DialogTitle className="text-[15px] font-semibold mb-4">
            {txHash ? `${title}!` : `${title} - ${selectedCoin?.symbol}`}
          </DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>

          {txHash ? (
            <div className="text-center pt-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-6">
                <Check className="h-7 w-7 text-white" />
              </div>
              <p className="text-foreground text-sm font-semibold mb-1">
                Role {isGrant ? 'Granted' : 'Revoked'}
              </p>
              <p className="text-muted-foreground text-sm mb-6">
                {ROLE_OPTIONS.find(r => r.value === selectedRole)?.label} role
              </p>
              <div className="bg-muted/50 rounded-xl p-4 space-y-3 text-left mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Address</span>
                  <span className="font-mono text-xs text-foreground">
                    {roleAddress.slice(0, 10)}...{roleAddress.slice(-6)}
                  </span>
                </div>
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
              </div>
              <Button className="w-full h-10" onClick={handleClose}>
                Done
              </Button>
            </div>
          ) : (
            <>
              <p className="text-[13px] text-muted-foreground mb-4">
                {isGrant ? (
                  <>
                    Grant a permission role to another address. This allows them to perform specific
                    actions on this token.{' '}
                    <span className="text-amber-600">Requires Admin role.</span>
                  </>
                ) : (
                  <>
                    Remove a permission role from an address. They will no longer be able to perform
                    the associated actions.{' '}
                    <span className="text-amber-600">Requires Admin role.</span>
                  </>
                )}
              </p>
              <div className="space-y-4">
                <AddressInput label="Address" value={roleAddress} onChange={setRoleAddress} />
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Role
                  </label>
                  <Select value={selectedRole} onValueChange={v => setSelectedRole(v as TokenRole)}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map(role => (
                        <SelectItem key={role.value} value={role.value}>
                          <div>
                            <span className="font-medium">{role.label}</span>
                            <span className="text-muted-foreground ml-2 text-[11px]">
                              {role.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isGrant && (
                <FeeTokenSelector
                  value={feeToken}
                  onChange={setFeeToken}
                  className="pt-4 mt-4 border-t border-border"
                />
              )}

              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  className="flex-1 h-10"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 h-10"
                  variant={isGrant ? 'default' : 'destructive'}
                  onClick={handleSubmit}
                  disabled={isSubmitting || !roleAddress}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isGrant ? 'Granting' : 'Revoking'}
                    </>
                  ) : (
                    buttonLabel
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
