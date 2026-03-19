import { useState, useEffect, useCallback, useRef, type ReactElement } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { toast } from '@/lib/toast';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@temporium/shared-ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import { ContactPicker } from '@/components/ContactPicker';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { ROLE_OPTIONS } from '@/lib/constants';
import { useStablecoins } from '@/hooks/useStablecoins';
import { useTokenList } from '@/hooks/useTokenList';
import type { StablecoinWithMetadata, TokenRole } from '@/types';
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
  const { address } = useAccount();
  const { grantRoles, revokeRoles } = useStablecoins();
  const { tokens } = useTokenList();

  const [roleAddress, setRoleAddress] = useState('');
  const [selectedRole, setSelectedRole] = useState<TokenRole>('issuer');
  const [feeToken, setFeeToken] = useState<Token | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  const isGrant = mode === 'grant';
  const title = isGrant ? 'Grant Role' : 'Revoke Role';
  const _buttonLabel = isGrant ? 'Grant' : 'Revoke';

  // Reset form only when modal opens (not when tokens refetch)
  useEffect(() => {
    if (isOpen) {
      setRoleAddress('');
      setSelectedRole('issuer');
      setFeeToken(tokens[0] ?? null);
      setTxHash(null);
      setIsSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <DialogContent className="sm:max-w-[400px] p-0 gap-0 rounded-2xl">
        {txHash ? (
          <>
            <DialogTitle className="sr-only">Role {isGrant ? 'Granted' : 'Revoked'}!</DialogTitle>
            <DialogDescription className="sr-only">
              {ROLE_OPTIONS.find(r => r.value === selectedRole)?.label} role
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
              <p className="text-[15px] font-bold text-[#2D3436] mb-1">
                Role {isGrant ? 'Granted' : 'Revoked'}!
              </p>

              {/* Hero value */}
              <div className="mb-6">
                <span className="text-3xl font-bold text-[#2D3436]">
                  {ROLE_OPTIONS.find(r => r.value === selectedRole)?.label}
                </span>
                <span className="text-lg text-[#9B9590] ml-1.5 font-semibold">
                  {isGrant ? 'granted' : 'revoked'}
                </span>
              </div>

              {/* Details card */}
              <div className="bg-[#FDFBF8] rounded-xl p-4 border border-[#EDE9E3] space-y-3 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    Address
                  </span>
                  <span className="text-[12px] font-medium text-[#2D3436] font-mono">
                    {roleAddress.slice(0, 10)}...{roleAddress.slice(-6)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[#EDE9E3]">
                  <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                    Transaction
                  </span>
                  <span className="font-mono text-[12px] text-[#2D3436]">
                    {txHash.slice(0, 10)}...{txHash.slice(-4)}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                onClick={() => window.open(getExplorerTxUrl(txHash), '_blank')}
                className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Explorer
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl font-semibold bg-[var(--color-sage)] hover:bg-[var(--color-sage)]/80 text-white"
                onClick={handleClose}
              >
                Done
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="px-6 pt-6 pb-5 pr-14">
              <DialogTitle className="text-lg font-bold text-[#2D3436]">{title}</DialogTitle>
              <DialogDescription className="text-[13px] font-light text-[#9B9590]">
                {isGrant
                  ? 'Grant a permission role to another address'
                  : 'Remove a permission role from an address'}
              </DialogDescription>
            </div>
            <div className="px-6 pb-4">
              <p className="text-[13px] font-light text-[#9B9590] mb-3">
                <span className="text-[var(--color-warning)]">Requires Admin role.</span>
              </p>
              <div className="space-y-3">
                <ContactPicker
                  value={roleAddress}
                  onChange={setRoleAddress}
                  label="Address"
                  showValidation={false}
                  selfAddress={address}
                />
                <div>
                  <label className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-2 block">
                    Role
                  </label>
                  <Select value={selectedRole} onValueChange={v => setSelectedRole(v as TokenRole)}>
                    <SelectTrigger className="w-full !h-[46px] px-4 rounded-xl border-[#EDE9E3] bg-[#FDFBF8] text-[14px] text-[#2D3436] shadow-none focus:border-coral/40 transition-colors">
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
            </div>

            {isGrant && feeToken && tokens.length > 0 && (
              <div className="px-6 pb-4 flex items-center justify-between">
                <span className="text-[12px] text-[#9B9590]">Gas paid in</span>
                <FeeTokenPicker value={feeToken} tokens={tokens} onChange={setFeeToken} />
              </div>
            )}

            <div className="px-6 pb-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl border-[#EDE9E3] text-[#6B6560] hover:bg-[#F5F2ED]"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              {isGrant ? (
                <Button
                  className="flex-1 h-11 rounded-xl font-semibold bg-coral hover:bg-coral/80 text-white"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !roleAddress}
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                  {isSubmitting ? 'Granting...' : 'Grant'}
                </Button>
              ) : (
                <Button
                  className="flex-1 h-11 rounded-xl font-semibold bg-coral hover:bg-coral/80 text-white"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !roleAddress}
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                  {isSubmitting ? 'Revoking...' : 'Revoke'}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
