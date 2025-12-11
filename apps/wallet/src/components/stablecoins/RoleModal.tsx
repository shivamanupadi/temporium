import { useState, useEffect, useCallback, type ReactElement } from 'react';
import { motion } from 'framer-motion';
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

  const isGrant = mode === 'grant';
  const title = isGrant ? 'Grant Role' : 'Revoke Role';
  const successMessage = isGrant ? 'Role granted successfully' : 'Role revoked successfully';
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
      toast.success(successMessage);
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to ${mode} role`;
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    selectedCoin,
    roleAddress,
    selectedRole,
    feeToken,
    isGrant,
    grantRoles,
    revokeRoles,
    successMessage,
    mode,
    onSuccess,
  ]);

  const handleClose = useCallback((): void => {
    if (!isSubmitting) {
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
            <div className="text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4"
              >
                <Check className="h-6 w-6 text-success" />
              </motion.div>
              <p className="text-[13px] text-muted-foreground mb-4">{successMessage}</p>
              <div className="flex gap-2">
                <a
                  href={getExplorerTxUrl(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg border border-border text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Explorer <ExternalLink className="h-3 w-3" />
                </a>
                <Button className="flex-1 h-10" onClick={handleClose}>
                  Done
                </Button>
              </div>
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
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : buttonLabel}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
