import { useState, useRef, type ReactElement } from 'react';
import { toast } from 'sonner';
import { Plus, Loader2, X, Flame, Send, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { BurnTokensModal } from './BurnTokensModal';
import { SendTokensModal } from './SendTokensModal';
import { FeeTokenSelector } from '@/components/FeeTokenSelector';
import type { Token } from '@/lib/tokenlist';
import { useStablecoin } from '@/hooks/useStablecoin';
import { useTempo } from '@/hooks/useTempo';
import { formatAmount } from '@/lib/utils';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { ROLE_OPTIONS } from '@/lib/constants';
import type { TokenRole } from '@/types';

const ALL_ROLES: TokenRole[] = ['issuer', 'pause', 'unpause', 'burnBlocked', 'defaultAdmin'];

function getRoleLabel(role: TokenRole): string {
  const labels: Record<TokenRole, string> = {
    issuer: 'Issuer',
    pause: 'Pause',
    unpause: 'Unpause',
    burnBlocked: 'Burn Blocked',
    defaultAdmin: 'Admin',
  };
  return labels[role];
}

function getRoleColor(role: TokenRole): string {
  const colors: Record<TokenRole, string> = {
    defaultAdmin: 'bg-purple-100 text-purple-700',
    issuer: 'bg-blue-100 text-blue-700',
    pause: 'bg-amber-100 text-amber-700',
    unpause: 'bg-green-100 text-green-700',
    burnBlocked: 'bg-rose-100 text-rose-700',
  };
  return colors[role];
}

interface YourAccessCardProps {
  tokenAddress: string;
}

export function YourAccessCard({ tokenAddress }: YourAccessCardProps): ReactElement {
  const { address: userAddress } = useTempo();
  const { stablecoin, grantRoles, revokeRoles, refresh } = useStablecoin(tokenAddress);

  const [roleLoading, setRoleLoading] = useState<TokenRole | null>(null);
  const [roleConfirm, setRoleConfirm] = useState<{
    action: 'grant' | 'revoke';
    role: TokenRole;
  } | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [roleFeeToken, setRoleFeeToken] = useState<Token | null>(null);
  const [showBurnModal, setShowBurnModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [roleTxHash, setRoleTxHash] = useState<string | null>(null);
  const isConfirmingRef = useRef(false);

  const decimals = stablecoin?.metadata?.decimals ?? 6;

  const handleGrantRoleToSelf = (role: TokenRole): void => {
    setRoleConfirm({ action: 'grant', role });
  };

  const handleRevokeRoleFromSelf = (role: TokenRole): void => {
    setRoleConfirm({ action: 'revoke', role });
  };

  const confirmRoleAction = async (): Promise<void> => {
    if (!userAddress || !roleConfirm) return;
    const { action, role } = roleConfirm;
    setIsConfirming(true);
    isConfirmingRef.current = true;
    setRoleLoading(role);

    try {
      let result;
      if (action === 'grant') {
        result = await grantRoles({
          to: userAddress as `0x${string}`,
          roles: [role],
          feeToken: roleFeeToken?.address,
        });
      } else {
        result = await revokeRoles({ from: userAddress as `0x${string}`, roles: [role] });
      }
      setRoleTxHash(result.receipt.transactionHash);
      refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to ${action} role`;
      toast.error(message);
    } finally {
      setIsConfirming(false);
      isConfirmingRef.current = false;
      setRoleLoading(null);
    }
  };

  const handleDialogClose = (): void => {
    if (!isConfirming && !isConfirmingRef.current) {
      setRoleConfirm(null);
      setRoleFeeToken(null);
      setRoleTxHash(null);
    }
  };

  // Get roles the user doesn't have yet
  const availableRoles = ALL_ROLES.filter(role => !stablecoin?.userRoles?.includes(role));

  return (
    <>
      <div>
        <h2 className="text-[13px] font-semibold text-foreground mb-3">Your Access</h2>
        <div className="bg-white rounded-xl p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Your Balance
              </p>
              <p className="text-xl font-bold text-foreground mt-1">
                {stablecoin?.userBalance !== undefined
                  ? formatAmount(stablecoin.userBalance.toString(), decimals)
                  : '—'}
              </p>
              <p className="text-[11px] text-muted-foreground">{stablecoin?.symbol}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-[12px]"
                onClick={() => setShowSendModal(true)}
              >
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Send
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-[12px]"
                onClick={() => setShowBurnModal(true)}
              >
                <Flame className="h-3.5 w-3.5 mr-1.5" />
                Burn
              </Button>
            </div>
          </div>
          <div className="border-t border-[rgba(0,0,0,0.05)] pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Your Roles
              </p>
              {availableRoles.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors">
                      <Plus className="h-3 w-3" />
                      Add Role
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {availableRoles.map(role => {
                      const roleOption = ROLE_OPTIONS.find(r => r.value === role);
                      return (
                        <DropdownMenuItem
                          key={role}
                          onClick={() => handleGrantRoleToSelf(role)}
                          disabled={roleLoading === role}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{getRoleLabel(role)}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {roleOption?.description}
                            </span>
                          </div>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            {stablecoin?.userRoles && stablecoin.userRoles.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                {stablecoin.userRoles.map(role => (
                  <button
                    key={role}
                    onClick={() => handleRevokeRoleFromSelf(role)}
                    disabled={roleLoading === role}
                    className={`group flex items-center gap-1 text-[11px] font-medium pl-2.5 pr-1.5 py-1 rounded-full transition-all ${getRoleColor(role)} hover:opacity-80`}
                    title={`Click to revoke ${getRoleLabel(role)} role`}
                  >
                    {roleLoading === role ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        {getRoleLabel(role)}
                        <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                      </>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No roles assigned</p>
            )}
          </div>
        </div>
      </div>

      {/* Role Confirmation Dialog */}
      <Dialog open={roleConfirm !== null} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
          <div className="p-5">
            <DialogTitle className="text-[15px] font-semibold mb-2">
              {roleTxHash
                ? `Role ${roleConfirm?.action === 'grant' ? 'Granted' : 'Removed'}!`
                : roleConfirm?.action === 'grant'
                  ? 'Grant Role to Yourself'
                  : 'Remove Role from Yourself'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {roleConfirm?.action === 'grant' ? 'Grant role' : 'Remove role'}
            </DialogDescription>

            {roleTxHash ? (
              <div className="text-center pt-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-6">
                  <Check className="h-7 w-7 text-white" />
                </div>
                <p className="text-foreground text-sm font-semibold mb-1">
                  Role {roleConfirm?.action === 'grant' ? 'Granted' : 'Removed'}
                </p>
                <p className="text-muted-foreground text-sm mb-6">
                  {roleConfirm ? getRoleLabel(roleConfirm.role) : ''} role
                </p>
                <div className="bg-muted/50 rounded-xl p-4 space-y-3 text-left mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Transaction</span>
                    <button
                      onClick={() => window.open(getExplorerTxUrl(roleTxHash), '_blank')}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                    >
                      <span className="font-mono">
                        {roleTxHash.slice(0, 8)}...{roleTxHash.slice(-4)}
                      </span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <Button className="w-full h-10" onClick={handleDialogClose}>
                  Done
                </Button>
              </div>
            ) : (
              <>
                <p className="text-[13px] text-muted-foreground">
                  {roleConfirm?.action === 'grant' ? (
                    <>
                      You are about to grant the{' '}
                      <span className="font-semibold text-foreground">
                        {roleConfirm ? getRoleLabel(roleConfirm.role) : ''}
                      </span>{' '}
                      role to yourself.
                      <br />
                      <br />
                      <span className="text-amber-600">Note: This requires the Admin role.</span>
                    </>
                  ) : (
                    <>
                      You are about to remove the{' '}
                      <span className="font-semibold text-foreground">
                        {roleConfirm ? getRoleLabel(roleConfirm.role) : ''}
                      </span>{' '}
                      role from yourself.
                      <br />
                      <br />
                      You will lose the permissions associated with this role. You can add it back
                      later if you have Admin access.
                    </>
                  )}
                </p>

                {roleConfirm?.action === 'grant' && (
                  <FeeTokenSelector
                    value={roleFeeToken}
                    onChange={setRoleFeeToken}
                    className="pt-4 mt-4 border-t border-border"
                  />
                )}

                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    className="flex-1 h-10"
                    onClick={handleDialogClose}
                    disabled={isConfirming}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 h-10"
                    variant={roleConfirm?.action === 'revoke' ? 'destructive' : 'default'}
                    onClick={confirmRoleAction}
                    disabled={isConfirming}
                  >
                    {isConfirming ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {roleConfirm?.action === 'grant' ? 'Granting' : 'Removing'}
                      </>
                    ) : roleConfirm?.action === 'grant' ? (
                      'Grant Role'
                    ) : (
                      'Remove Role'
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Burn Tokens Modal */}
      <BurnTokensModal
        isOpen={showBurnModal}
        selectedCoin={stablecoin ?? null}
        onSuccess={refresh}
        onClose={() => setShowBurnModal(false)}
      />

      {/* Send Tokens Modal */}
      <SendTokensModal
        isOpen={showSendModal}
        selectedCoin={stablecoin ?? null}
        onSuccess={refresh}
        onClose={() => setShowSendModal(false)}
      />
    </>
  );
}
