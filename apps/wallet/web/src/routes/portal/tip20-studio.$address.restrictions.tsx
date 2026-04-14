import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, type ReactElement } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldX,
  ShieldOff,
  UserPlus,
  UserMinus,
  Search,
  Loader2,
  ChevronRight,
  Info,
} from 'lucide-react';
import { useTip20Studio } from '@/hooks/useTip20Studio';
import { useTempo } from '@/hooks/useTempo';
import { Actions, tempoPublicClient } from '@/lib/tempo-client';
import { SetupRestrictionsModal, ManageAddressModal } from '@/components/stablecoins';
import type { RestrictionMode } from '@/components/stablecoins/SetupRestrictionsModal';
import type { PolicyType } from '@/types';

export const Route = createFileRoute('/portal/tip20-studio/$address/restrictions')({
  component: Tip20StudioRestrictions,
});

type RestrictionsModal =
  | 'setup-restrictions'
  | 'add-address'
  | 'remove-address'
  | 'check-address'
  | null;

interface PolicyInfo {
  policyId: bigint;
  type: PolicyType;
  admin: string;
}

function deriveRestrictionMode(
  policyId: bigint | undefined,
  policyType: PolicyType | undefined
): RestrictionMode {
  if (!policyId || policyId === 1n) return 'open';
  if (policyId === 0n) return 'open';
  if (policyType === 'whitelist') return 'allowed-list';
  if (policyType === 'blacklist') return 'blocked-list';
  return 'open';
}

function Tip20StudioRestrictions(): ReactElement {
  const { address: tokenAddress } = Route.useParams();
  const { address: userAddress } = useTempo();

  const { stablecoin, isLoading, changeTransferPolicy, refresh } = useTip20Studio(tokenAddress);

  const [activeModal, setActiveModal] = useState<RestrictionsModal>(null);
  const [targetMode, setTargetMode] = useState<RestrictionMode>('open');
  const [policyInfo, setPolicyInfo] = useState<PolicyInfo | null>(null);
  const [isLoadingPolicy, setIsLoadingPolicy] = useState(false);

  useEffect(() => {
    const fetchPolicyInfo = async (): Promise<void> => {
      const policyId = stablecoin?.metadata?.transferPolicyId;
      if (!policyId || policyId < 2n) {
        setPolicyInfo(null);
        return;
      }
      setIsLoadingPolicy(true);
      try {
        const data = await Actions.policy.getData(tempoPublicClient, { policyId });
        setPolicyInfo({ policyId, type: data.type as PolicyType, admin: data.admin });
      } catch (err) {
        console.error('Failed to fetch policy info:', err);
        setPolicyInfo(null);
      } finally {
        setIsLoadingPolicy(false);
      }
    };
    fetchPolicyInfo();
  }, [stablecoin?.metadata?.transferPolicyId]);

  const closeModal = (): void => setActiveModal(null);
  const handleSuccess = (): void => {
    refresh();
  };

  const currentMode = deriveRestrictionMode(
    stablecoin?.metadata?.transferPolicyId,
    policyInfo?.type
  );
  const isAdmin = stablecoin?.userRoles?.includes('defaultAdmin') ?? false;
  const isPolicyAdmin =
    userAddress && policyInfo?.admin
      ? policyInfo.admin.toLowerCase() === userAddress.toLowerCase()
      : false;
  const hasRestrictions = currentMode !== 'open';
  const isTransfersBlocked = stablecoin?.metadata?.transferPolicyId === 0n;
  const isAllowedList = currentMode === 'allowed-list';

  const handleModeSelect = (mode: RestrictionMode): void => {
    if (mode === currentMode) return;
    if (!isAdmin) return;
    setTargetMode(mode);
    setActiveModal('setup-restrictions');
  };

  if (isLoading || !stablecoin) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 text-coral animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="max-w-3xl">
        {/* Mode Selector */}
        <div className="mb-6">
          <h2 className="text-[15px] font-semibold text-[#2D3436] mb-3">Transfer Restrictions</h2>
          <p className="text-[13px] text-[#9B9590] mb-4">
            Control which addresses can send and receive {stablecoin.symbol}
          </p>

          {isTransfersBlocked && (
            <div className="bg-coral/5 border border-coral/20 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-coral/10 flex items-center justify-center">
                  <ShieldOff className="h-5 w-5 text-coral" />
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-coral">All Transfers Blocked</p>
                  <p className="text-[11px] text-[#9B9590]">
                    No addresses can transfer this token. Select a mode below to allow transfers.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Mode Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ModeCard
              label="No Restrictions"
              description="All addresses can transfer freely"
              icon={<Shield className="h-5 w-5" />}
              isActive={currentMode === 'open' && !isTransfersBlocked}
              isDisabled={!isAdmin}
              color="muted"
              onClick={() => handleModeSelect('open')}
            />
            <ModeCard
              label="Allowed Addresses"
              description="Only approved addresses can transfer"
              icon={<ShieldCheck className="h-5 w-5" />}
              isActive={currentMode === 'allowed-list'}
              isDisabled={!isAdmin}
              color="sage"
              onClick={() => handleModeSelect('allowed-list')}
            />
            <ModeCard
              label="Blocked Addresses"
              description="Specific addresses are blocked"
              icon={<ShieldX className="h-5 w-5" />}
              isActive={currentMode === 'blocked-list'}
              isDisabled={!isAdmin}
              color="coral"
              onClick={() => handleModeSelect('blocked-list')}
            />
          </div>

          {!isAdmin && (
            <p className="text-[11px] text-muted-foreground text-center mt-3">
              You need the Admin role to change transfer restrictions
            </p>
          )}
        </div>

        {/* Address Management Section */}
        {hasRestrictions && !isLoadingPolicy && policyInfo && (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border/50">
              <h3 className="text-[13px] font-semibold text-[#2D3436]">
                {isAllowedList ? 'Allowed Addresses' : 'Blocked Addresses'}
              </h3>
              <p className="text-[11px] text-[#9B9590] mt-0.5">
                {isAllowedList
                  ? 'Only these addresses can transfer this token'
                  : 'These addresses cannot transfer this token'}
              </p>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                <button
                  onClick={() => setActiveModal('add-address')}
                  disabled={!isPolicyAdmin}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    isPolicyAdmin
                      ? 'border-[#EDE9E3] hover:bg-[#F5F2ED]/50 hover:border-[#D1CCC7] cursor-pointer'
                      : 'border-[#EDE9E3] opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isAllowedList ? 'bg-[var(--color-sage)]/10' : 'bg-coral/8'}`}
                  >
                    <UserPlus
                      className={`h-4 w-4 ${isAllowedList ? 'text-[var(--color-sage)]' : 'text-coral'}`}
                    />
                  </div>
                  <div className="text-left">
                    <p className="text-[12px] font-medium text-[#2D3436]">
                      {isAllowedList ? 'Add Address' : 'Block Address'}
                    </p>
                    <p className="text-[10px] text-[#B5B0AA]">
                      {isAllowedList ? 'Allow transfers' : 'Prevent transfers'}
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveModal('remove-address')}
                  disabled={!isPolicyAdmin}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    isPolicyAdmin
                      ? 'border-[#EDE9E3] hover:bg-[#F5F2ED]/50 hover:border-[#D1CCC7] cursor-pointer'
                      : 'border-[#EDE9E3] opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-[#F5F2ED] flex items-center justify-center shrink-0">
                    <UserMinus className="h-4 w-4 text-[#6B6560]" />
                  </div>
                  <div className="text-left">
                    <p className="text-[12px] font-medium text-[#2D3436]">
                      {isAllowedList ? 'Remove Address' : 'Unblock Address'}
                    </p>
                    <p className="text-[10px] text-[#B5B0AA]">
                      {isAllowedList ? 'Revoke permission' : 'Restore access'}
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveModal('check-address')}
                  className="flex items-center gap-3 p-3 rounded-xl border border-[#EDE9E3] hover:bg-[#F5F2ED]/50 hover:border-[#D1CCC7] transition-colors cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#F5F2ED] flex items-center justify-center shrink-0">
                    <Search className="h-4 w-4 text-[#6B6560]" />
                  </div>
                  <div className="text-left">
                    <p className="text-[12px] font-medium text-[#2D3436]">Check Address</p>
                    <p className="text-[10px] text-[#B5B0AA]">Verify transfer status</p>
                  </div>
                </button>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F5F2ED]/50">
                <Info className="h-4 w-4 text-[#9B9590] shrink-0 mt-0.5" />
                <p className="text-[11px] text-[#9B9590] leading-relaxed">
                  Addresses are stored on the blockchain. Use &quot;Check Address&quot; to verify if
                  a specific address can transfer this token. Each change requires a blockchain
                  transaction.
                </p>
              </div>

              {!isPolicyAdmin && (
                <div className="mt-3 flex items-start gap-2.5 p-3 rounded-xl bg-[var(--color-warning)]/8 border border-[var(--color-warning)]/20">
                  <Info className="h-4 w-4 text-[var(--color-warning)] shrink-0 mt-0.5" />
                  <p className="text-[11px] text-[var(--color-warning)] leading-relaxed">
                    You don&apos;t have permission to manage addresses on this restriction list.
                    Only the list administrator can add or remove addresses.
                  </p>
                </div>
              )}
            </div>

            {isAdmin && (
              <div className="px-5 py-3 border-t border-border/50">
                <button
                  onClick={() => handleModeSelect('open')}
                  className="group w-full flex items-center justify-between py-2 transition-all cursor-pointer hover:opacity-80"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-coral/6 flex items-center justify-center shrink-0">
                      <ShieldOff className="h-4 w-4 text-coral" />
                    </div>
                    <div className="text-left">
                      <p className="text-[12px] font-medium text-coral leading-tight">
                        Remove Restrictions
                      </p>
                      <p className="text-[10px] text-[#B5B0AA] leading-tight mt-0.5">
                        Allow all addresses to transfer freely
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-coral/50 group-hover:text-coral transition-colors" />
                </button>
              </div>
            )}
          </div>
        )}

        {hasRestrictions && isLoadingPolicy && (
          <div className="bg-card rounded-2xl border border-border p-8 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
            <span className="text-[13px] text-muted-foreground ml-3">
              Loading restriction details...
            </span>
          </div>
        )}

        {!hasRestrictions && !isTransfersBlocked && (
          <div className="bg-card rounded-2xl border border-border p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Shield className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-[14px] font-medium text-[#2D3436] mb-1">No Restrictions Active</p>
            <p className="text-[12px] text-[#9B9590] mb-4">
              All addresses can freely transfer {stablecoin.symbol}. Select a restriction mode above
              to control who can transfer.
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      <SetupRestrictionsModal
        isOpen={activeModal === 'setup-restrictions'}
        selectedCoin={stablecoin ?? null}
        targetMode={targetMode}
        currentMode={currentMode}
        onChangePolicy={changeTransferPolicy}
        onSuccess={handleSuccess}
        onClose={closeModal}
      />

      {policyInfo && (
        <>
          <ManageAddressModal
            isOpen={activeModal === 'add-address'}
            mode="add"
            restrictionMode={currentMode as 'allowed-list' | 'blocked-list'}
            policyId={policyInfo.policyId}
            onSuccess={handleSuccess}
            onClose={closeModal}
          />
          <ManageAddressModal
            isOpen={activeModal === 'remove-address'}
            mode="remove"
            restrictionMode={currentMode as 'allowed-list' | 'blocked-list'}
            policyId={policyInfo.policyId}
            onSuccess={handleSuccess}
            onClose={closeModal}
          />
          <ManageAddressModal
            isOpen={activeModal === 'check-address'}
            mode="check"
            restrictionMode={currentMode as 'allowed-list' | 'blocked-list'}
            policyId={policyInfo.policyId}
            onSuccess={handleSuccess}
            onClose={closeModal}
          />
        </>
      )}
    </>
  );
}

interface ModeCardProps {
  label: string;
  description: string;
  icon: ReactElement;
  isActive: boolean;
  isDisabled: boolean;
  color: 'muted' | 'sage' | 'coral';
  onClick: () => void;
}

function ModeCard({
  label,
  description,
  icon,
  isActive,
  isDisabled,
  color,
  onClick,
}: ModeCardProps): ReactElement {
  const colorClasses = {
    muted: {
      active: 'border-[#9B9590] bg-muted/50',
      icon: 'bg-muted text-muted-foreground',
      label: 'text-[#2D3436]',
    },
    sage: {
      active: 'border-[var(--color-sage)] bg-[var(--color-sage)]/5',
      icon: 'bg-[var(--color-sage)]/10 text-[var(--color-sage)]',
      label: 'text-[var(--color-sage)]',
    },
    coral: {
      active: 'border-coral bg-coral/5',
      icon: 'bg-coral/8 text-coral',
      label: 'text-coral',
    },
  };
  const c = colorClasses[color];

  return (
    <button
      onClick={onClick}
      disabled={isDisabled || isActive}
      className={`relative p-4 rounded-xl border-2 transition-all text-left ${
        isActive
          ? `${c.active} shadow-sm`
          : isDisabled
            ? 'border-border/50 opacity-50 cursor-not-allowed'
            : 'border-border hover:border-[#D1CCC7] cursor-pointer hover:shadow-sm'
      }`}
    >
      {isActive && (
        <div
          className={`absolute top-2 right-2 w-2 h-2 rounded-full ${color === 'sage' ? 'bg-[var(--color-sage)]' : color === 'coral' ? 'bg-coral' : 'bg-[#9B9590]'}`}
        />
      )}
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 ${c.icon}`}>
        {icon}
      </div>
      <p className={`text-[12px] font-semibold mb-0.5 ${isActive ? c.label : 'text-[#2D3436]'}`}>
        {label}
      </p>
      <p className="text-[10px] text-[#9B9590] leading-relaxed">{description}</p>
    </button>
  );
}
