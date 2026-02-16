import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState, useEffect, type ReactElement } from 'react';
import { toast } from '@/lib/toast';
import {
  CircleDollarSign,
  Plus,
  Pause,
  Play,
  Gauge,
  UserPlus,
  UserMinus,
  Ban,
  Trash2,
  ChevronRight,
  ExternalLink,
  Loader2,
  Copy,
  Check,
  ShieldCheck,
  ShieldX,
  ShieldOff,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  MintTokensModal,
  SupplyCapModal,
  RoleModal,
  BurnBlockedModal,
  PauseTokenModal,
  RemoveConfirmModal,
  LinkPolicyModal,
  UnlinkPolicyModal,
  CreateAndLinkPolicyModal,
  YourAccessCard,
} from '@/components/stablecoins';
import { useTip20Studio } from '@/hooks/useTip20Studio';
import { useTempo } from '@/hooks/useTempo';
import { formatAmount, formatAddress, isUnlimitedSupply } from '@/lib/utils';
import {
  getExplorerTokenUrl,
  getExplorerAddressUrl,
  Actions,
  tempoPublicClient,
} from '@/lib/tempo-client';
import type { PolicyType } from '@/types';

export const Route = createFileRoute('/portal/tip20-studio/$address/overview')({
  component: Tip20StudioOverview,
});

type DashboardModal =
  | 'mint'
  | 'pause'
  | 'supply-cap'
  | 'grant-role'
  | 'revoke-role'
  | 'burn-blocked'
  | 'link-policy'
  | 'unlink-policy'
  | 'create-policy'
  | 'remove'
  | null;

interface PolicyInfo {
  policyId: bigint;
  type: PolicyType;
  admin: string;
}

function Tip20StudioOverview(): ReactElement {
  const { address: tokenAddress } = Route.useParams();
  const navigate = useNavigate();
  const { address: userAddress } = useTempo();

  const { stablecoin, isLoading, changeTransferPolicy, removeStablecoin, refresh } =
    useTip20Studio(tokenAddress);

  const [activeModal, setActiveModal] = useState<DashboardModal>(null);
  const [copied, setCopied] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
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
        setPolicyInfo({
          policyId,
          type: data.type as PolicyType,
          admin: data.admin,
        });
      } catch (err) {
        console.error('Failed to fetch policy info:', err);
        setPolicyInfo(null);
      } finally {
        setIsLoadingPolicy(false);
      }
    };

    fetchPolicyInfo();
  }, [stablecoin?.metadata?.transferPolicyId]);

  const closeModal = (): void => {
    setActiveModal(null);
  };

  const handleSuccess = (): void => {
    refresh();
  };

  const handleRemove = async (): Promise<void> => {
    setIsRemoving(true);
    try {
      await removeStablecoin();
      toast.success('Removed from list');
      navigate({ to: '/portal/tip20-studio' });
    } finally {
      setIsRemoving(false);
    }
  };

  const copyAddress = async (): Promise<void> => {
    await navigator.clipboard.writeText(tokenAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading || !stablecoin) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 text-lavender animate-spin" />
      </div>
    );
  }

  const isPaused = stablecoin?.metadata?.paused;
  const decimals = stablecoin?.metadata?.decimals ?? 6;

  return (
    <>
      {/* Two Column Layout */}
      <div className="lg:flex lg:gap-6 lg:items-stretch">
        {/* Left Column - Main Content */}
        <div className="lg:flex-[3]">
          {/* Hero Section */}
          <div className="bg-lavender/5 rounded-2xl p-6 mb-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-card shadow-sm flex items-center justify-center">
                  <CircleDollarSign className="h-8 w-8 text-lavender" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-foreground">{stablecoin?.name}</h1>
                    {isPaused && (
                      <span className="text-[11px] font-medium text-[var(--color-warning)] bg-[var(--color-warning)]/15 px-2 py-0.5 rounded-full">
                        Paused
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-medium text-muted-foreground">
                      {stablecoin?.symbol}
                    </span>
                    <span className="text-muted-foreground">&bull;</span>
                    <span className="text-sm text-muted-foreground">{stablecoin?.currency}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={copyAddress}
                      className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground font-mono transition-colors cursor-pointer"
                    >
                      {formatAddress(tokenAddress, 8)}
                      {copied ? (
                        <Check className="h-3 w-3 text-[var(--color-sage)]" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                    <a
                      href={getExplorerTokenUrl(tokenAddress)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] text-lavender hover:text-lavender/80 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={() => setActiveModal('mint')}
                className="flex-1 h-11 rounded-xl font-semibold bg-lavender hover:bg-lavender/80 text-white"
              >
                <Plus className="h-4 w-4 mr-2" /> Mint
              </Button>
              <Button
                onClick={() => setActiveModal('pause')}
                variant="outline"
                className="flex-1 h-11 bg-card"
              >
                {isPaused ? (
                  <>
                    <Play className="h-4 w-4 mr-2" /> Unpause
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-2" /> Pause
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-card rounded-xl p-4 shadow-xs border border-border">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Total Supply
              </p>
              <p className="text-xl font-bold text-foreground mt-1">
                {stablecoin?.metadata?.totalSupply !== undefined
                  ? formatAmount(stablecoin.metadata.totalSupply.toString(), decimals)
                  : '\u2014'}
              </p>
              <p className="text-[11px] text-muted-foreground">{stablecoin?.symbol}</p>
            </div>
            <div className="bg-card rounded-xl p-4 shadow-xs border border-border">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Supply Cap
              </p>
              <p className="text-xl font-bold text-foreground mt-1">
                {stablecoin?.metadata?.supplyCap &&
                !isUnlimitedSupply(stablecoin.metadata.supplyCap)
                  ? formatAmount(stablecoin.metadata.supplyCap.toString(), decimals)
                  : 'Unlimited'}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {stablecoin?.metadata?.supplyCap &&
                !isUnlimitedSupply(stablecoin.metadata.supplyCap)
                  ? stablecoin?.symbol
                  : ''}
              </p>
            </div>
          </div>

          {/* Your Access */}
          <YourAccessCard tokenAddress={tokenAddress} />

          {/* Transfer Policy Card */}
          <TransferPolicyCard
            policyId={stablecoin?.metadata?.transferPolicyId}
            policyInfo={policyInfo}
            isLoading={isLoadingPolicy}
            isAdmin={stablecoin?.userRoles?.includes('defaultAdmin') ?? false}
            userAddress={userAddress}
            onCreate={() => setActiveModal('create-policy')}
            onLink={() => setActiveModal('link-policy')}
            onUnlink={() => setActiveModal('unlink-policy')}
          />
        </div>

        {/* Right Column - Settings */}
        <div className="lg:flex-[2] mt-6 lg:mt-0">
          <div className="bg-white rounded-2xl border border-[#EDE9E3]/80 overflow-hidden h-full shadow-sm">
            <div className="px-5 py-4 border-b border-[#EDE9E3]/50">
              <h2 className="text-[13px] font-semibold text-[#2D3436] tracking-wide uppercase">
                Settings
              </h2>
            </div>

            {/* Token Operations */}
            <div className="px-4 pt-4 pb-1">
              <p className="text-[10px] font-semibold text-[#B5B0AA] uppercase tracking-widest px-1 mb-1">
                Token Operations
              </p>
            </div>
            <SettingsRow
              icon={<Plus className="h-4 w-4 text-[#6B6560]" />}
              title="Mint Tokens"
              description="Issue new tokens to an address"
              onClick={() => setActiveModal('mint')}
            />
            <SettingsRow
              icon={
                isPaused ? (
                  <Play className="h-4 w-4 text-[#6B6560]" />
                ) : (
                  <Pause className="h-4 w-4 text-[#6B6560]" />
                )
              }
              title={isPaused ? 'Unpause Token' : 'Pause Token'}
              description={
                isPaused ? 'Resume all token transfers' : 'Temporarily stop all transfers'
              }
              onClick={() => setActiveModal('pause')}
            />
            <SettingsRow
              icon={<Gauge className="h-4 w-4 text-[#6B6560]" />}
              title="Set Supply Cap"
              description="Limit maximum token supply"
              onClick={() => setActiveModal('supply-cap')}
            />
            <SettingsRow
              icon={<Ban className="h-4 w-4 text-[#6B6560]" />}
              title="Burn Blocked"
              description="Burn tokens from a blocked address"
              onClick={() => setActiveModal('burn-blocked')}
              isLast
            />

            {/* Role Management */}
            <div className="px-4 pt-4 pb-1 border-t border-[#EDE9E3]/50">
              <p className="text-[10px] font-semibold text-[#B5B0AA] uppercase tracking-widest px-1 mb-1">
                Role Management
              </p>
            </div>
            <SettingsRow
              icon={<UserPlus className="h-4 w-4 text-[#6B6560]" />}
              title="Grant Role"
              description="Give permissions to an address"
              onClick={() => setActiveModal('grant-role')}
            />
            <SettingsRow
              icon={<UserMinus className="h-4 w-4 text-[#6B6560]" />}
              title="Revoke Role"
              description="Remove permissions from an address"
              onClick={() => setActiveModal('revoke-role')}
              isLast
            />

            {/* Danger Zone */}
            <div className="px-4 pt-4 pb-1 border-t border-[#EDE9E3]/50">
              <p className="text-[10px] font-semibold text-coral/60 uppercase tracking-widest px-1 mb-1">
                Danger Zone
              </p>
            </div>
            <SettingsRow
              icon={<Trash2 className="h-4 w-4 text-coral" />}
              title="Remove from List"
              description="Remove from your local storage only"
              onClick={() => setActiveModal('remove')}
              variant="danger"
              isLast
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      <MintTokensModal
        isOpen={activeModal === 'mint'}
        selectedCoin={stablecoin ?? null}
        defaultMintTo={userAddress || ''}
        onSuccess={handleSuccess}
        onClose={closeModal}
      />

      <PauseTokenModal
        isOpen={activeModal === 'pause'}
        mode={isPaused ? 'unpause' : 'pause'}
        selectedCoin={stablecoin ?? null}
        onSuccess={handleSuccess}
        onClose={closeModal}
      />

      <SupplyCapModal
        isOpen={activeModal === 'supply-cap'}
        selectedCoin={stablecoin ?? null}
        onSuccess={handleSuccess}
        onClose={closeModal}
      />

      <RoleModal
        isOpen={activeModal === 'grant-role'}
        mode="grant"
        selectedCoin={stablecoin ?? null}
        onSuccess={handleSuccess}
        onClose={closeModal}
      />

      <RoleModal
        isOpen={activeModal === 'revoke-role'}
        mode="revoke"
        selectedCoin={stablecoin ?? null}
        onSuccess={handleSuccess}
        onClose={closeModal}
      />

      <BurnBlockedModal
        isOpen={activeModal === 'burn-blocked'}
        selectedCoin={stablecoin ?? null}
        onSuccess={handleSuccess}
        onClose={closeModal}
      />

      <LinkPolicyModal
        isOpen={activeModal === 'link-policy'}
        selectedCoin={stablecoin ?? null}
        onLink={changeTransferPolicy}
        onSuccess={handleSuccess}
        onClose={closeModal}
      />

      <CreateAndLinkPolicyModal
        isOpen={activeModal === 'create-policy'}
        selectedCoin={stablecoin ?? null}
        onLink={changeTransferPolicy}
        onSuccess={handleSuccess}
        onClose={closeModal}
      />

      {policyInfo && (
        <UnlinkPolicyModal
          isOpen={activeModal === 'unlink-policy'}
          selectedCoin={stablecoin ?? null}
          policyId={policyInfo.policyId}
          policyType={policyInfo.type}
          onUnlink={changeTransferPolicy}
          onSuccess={handleSuccess}
          onClose={closeModal}
        />
      )}

      <RemoveConfirmModal
        coin={activeModal === 'remove' ? (stablecoin ?? null) : null}
        isLoading={isRemoving}
        onConfirm={handleRemove}
        onCancel={closeModal}
      />
    </>
  );
}

interface SettingsRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
  isLast?: boolean;
}

function SettingsRow({
  icon,
  title,
  description,
  onClick,
  variant = 'default',
  isLast = false,
}: SettingsRowProps): ReactElement {
  return (
    <button
      onClick={onClick}
      className={`group w-full flex items-center justify-between px-5 py-3 transition-all cursor-pointer ${
        variant === 'danger' ? 'hover:bg-coral/4' : 'hover:bg-[#F5F2ED]/50'
      } ${!isLast ? 'border-b border-[#EDE9E3]/30' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            variant === 'danger' ? 'bg-coral/6' : 'bg-[#F5F2ED]'
          }`}
        >
          {icon}
        </div>
        <div className="text-left">
          <p
            className={`text-[13px] font-medium leading-tight ${variant === 'danger' ? 'text-coral' : 'text-[#2D3436]'}`}
          >
            {title}
          </p>
          <p className="text-[11px] text-[#B5B0AA] leading-tight mt-0.5">{description}</p>
        </div>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-[#D1CCC7] group-hover:text-[#9B9590] transition-colors" />
    </button>
  );
}

interface TransferPolicyCardProps {
  policyId: bigint | undefined;
  policyInfo: PolicyInfo | null;
  isLoading: boolean;
  isAdmin: boolean;
  userAddress: string | undefined;
  onCreate: () => void;
  onLink: () => void;
  onUnlink: () => void;
}

function TransferPolicyCard({
  policyId,
  policyInfo,
  isLoading,
  isAdmin,
  userAddress,
  onCreate,
  onLink,
  onUnlink,
}: TransferPolicyCardProps): ReactElement {
  const [copiedAdmin, setCopiedAdmin] = useState(false);

  const copyAdminAddress = async (): Promise<void> => {
    if (!policyInfo?.admin) return;
    await navigator.clipboard.writeText(policyInfo.admin);
    setCopiedAdmin(true);
    setTimeout(() => setCopiedAdmin(false), 2000);
  };

  const isPolicyAdmin =
    userAddress && policyInfo?.admin?.toLowerCase() === userAddress.toLowerCase();

  const getPolicyStatus = (): {
    icon: ReactElement;
    label: string;
    description: string;
    color: string;
    bgColor: string;
  } => {
    if (policyId === undefined || policyId === 1n) {
      return {
        icon: <Shield className="h-5 w-5 text-muted-foreground" />,
        label: 'No Restrictions',
        description: 'All transfers are allowed',
        color: 'text-muted-foreground',
        bgColor: 'bg-muted',
      };
    }
    if (policyId === 0n) {
      return {
        icon: <ShieldOff className="h-5 w-5 text-coral" />,
        label: 'Transfers Blocked',
        description: 'All transfers are rejected',
        color: 'text-coral',
        bgColor: 'bg-coral/10',
      };
    }
    if (policyInfo?.type === 'whitelist') {
      return {
        icon: <ShieldCheck className="h-5 w-5 text-[var(--color-sage)]" />,
        label: 'Whitelist Policy',
        description: 'Only approved addresses can transact',
        color: 'text-[var(--color-sage)]',
        bgColor: 'bg-[var(--color-sage)]/15',
      };
    }
    if (policyInfo?.type === 'blacklist') {
      return {
        icon: <ShieldX className="h-5 w-5 text-coral" />,
        label: 'Blacklist Policy',
        description: 'Blocked addresses cannot transact',
        color: 'text-coral',
        bgColor: 'bg-coral/10',
      };
    }
    return {
      icon: <Shield className="h-5 w-5 text-lavender" />,
      label: 'Custom Policy',
      description: 'Transfer restrictions apply',
      color: 'text-lavender',
      bgColor: 'bg-lavender/10',
    };
  };

  const status = getPolicyStatus();
  const hasCustomPolicy = policyId !== undefined && policyId >= 2n;
  const canLinkPolicy = policyId === undefined || policyId === 1n;

  const handleCreate = (): void => {
    if (!isAdmin) {
      toast.error('You need the Admin role to change the transfer policy');
      return;
    }
    onCreate();
  };

  const handleLink = (): void => {
    if (!isAdmin) {
      toast.error('You need the Admin role to change the transfer policy');
      return;
    }
    onLink();
  };

  const handleUnlink = (): void => {
    if (!isAdmin) {
      toast.error('You need the Admin role to change the transfer policy');
      return;
    }
    onUnlink();
  };

  return (
    <div className="bg-card rounded-xl p-4 shadow-xs border border-border mt-6">
      <h3 className="text-[13px] font-semibold text-foreground mb-3">Transfer Policy</h3>

      {isLoading ? (
        <div className="flex items-center gap-3 py-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading policy...</span>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Policy Status */}
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${status.bgColor}`}
            >
              {status.icon}
            </div>
            <div>
              <p className={`text-[13px] font-medium ${status.color}`}>{status.label}</p>
              <p className="text-[11px] text-muted-foreground">{status.description}</p>
            </div>
          </div>

          {/* Policy Actions - shown when no custom policy */}
          {canLinkPolicy && (
            <>
              <div className="h-px bg-border/50" />
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  className="flex items-center justify-center gap-2 flex-1 h-9 rounded-lg text-[12px] font-medium text-white bg-lavender hover:bg-lavender/80 transition-colors cursor-pointer"
                >
                  <Shield className="h-3.5 w-3.5" />
                  Create Policy
                </button>
                <button
                  onClick={handleLink}
                  className="flex items-center justify-center gap-2 flex-1 h-9 rounded-lg text-[12px] font-medium text-lavender bg-lavender/5 hover:bg-lavender/10 transition-colors cursor-pointer"
                >
                  <Shield className="h-3.5 w-3.5" />
                  Link Existing
                </button>
              </div>
              {!isAdmin && (
                <p className="text-[10px] text-muted-foreground text-center">Requires Admin role</p>
              )}
            </>
          )}

          {/* Policy Details for custom policies */}
          {hasCustomPolicy && policyInfo && (
            <>
              <div className="h-px bg-border/50" />
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-muted-foreground">Policy ID</span>
                  <span className="text-[12px] font-mono text-foreground">
                    {policyId.toString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">Policy Admin</span>
                    {isPolicyAdmin ? (
                      <span className="relative group">
                        <span className="text-[10px] font-medium text-[var(--color-sage)] bg-[var(--color-sage)]/10 px-1.5 py-0.5 rounded cursor-help">
                          You
                        </span>
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[10px] text-primary-foreground bg-foreground rounded whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-50">
                          You are the admin of this policy
                        </span>
                      </span>
                    ) : (
                      <span className="relative group">
                        <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded cursor-help">
                          Other
                        </span>
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[10px] text-primary-foreground bg-foreground rounded whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-50">
                          Someone else controls this policy
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[12px] font-mono text-foreground">
                      {formatAddress(policyInfo.admin, 6)}
                    </span>
                    <button
                      onClick={copyAdminAddress}
                      className="p-1 rounded hover:bg-muted transition-colors cursor-pointer"
                      title="Copy address"
                    >
                      {copiedAdmin ? (
                        <Check className="h-3 w-3 text-[var(--color-sage)]" />
                      ) : (
                        <Copy className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                    <a
                      href={getExplorerAddressUrl(policyInfo.admin)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded hover:bg-muted transition-colors"
                      title="View in explorer"
                    >
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </a>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <Link
                  to="/portal/tip403-factory"
                  search={{ policyId: policyId.toString() }}
                  className="flex items-center justify-center gap-2 flex-1 h-9 rounded-lg text-[12px] font-medium text-lavender bg-lavender/5 hover:bg-lavender/10 transition-colors"
                >
                  <Shield className="h-3.5 w-3.5" />
                  View Policy
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
                <button
                  onClick={handleUnlink}
                  className="flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg text-[12px] font-medium text-coral bg-coral/5 hover:bg-coral/10 transition-colors cursor-pointer"
                >
                  <ShieldOff className="h-3.5 w-3.5" />
                  Unlink
                </button>
              </div>
              {!isAdmin && (
                <p className="text-[10px] text-muted-foreground text-center">
                  Requires Admin role to unlink
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
