import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, type ReactElement } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft,
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  MintTokensModal,
  SupplyCapModal,
  RoleModal,
  BurnBlockedModal,
  PauseTokenModal,
  RemoveConfirmModal,
  YourAccessCard,
} from '@/components/stablecoins';
import { useStablecoin } from '@/hooks/useStablecoin';
import { useTempo } from '@/hooks/useTempo';
import { formatAmount, formatAddress, isUnlimitedSupply } from '@/lib/utils';
import { getExplorerTokenUrl } from '@/lib/tempo-client';

export const Route = createFileRoute('/portal/stablecoins/$address')({
  component: StablecoinDashboard,
});

type DashboardModal =
  | 'mint'
  | 'pause'
  | 'supply-cap'
  | 'grant-role'
  | 'revoke-role'
  | 'burn-blocked'
  | 'remove'
  | null;

function StablecoinDashboard(): ReactElement {
  const { address: tokenAddress } = Route.useParams();
  const navigate = useNavigate();
  const { address: userAddress } = useTempo();

  const { stablecoin, isLoading, isNotFound, removeStablecoin, refresh } =
    useStablecoin(tokenAddress);

  // Modal state
  const [activeModal, setActiveModal] = useState<DashboardModal>(null);

  // Copy state
  const [copied, setCopied] = useState(false);

  const closeModal = (): void => {
    setActiveModal(null);
  };

  const handleSuccess = (): void => {
    refresh();
  };

  const handleRemove = async (): Promise<void> => {
    await removeStablecoin();
    toast.success('Removed from list');
    navigate({ to: '/portal/stablecoins' });
  };

  const copyAddress = async (): Promise<void> => {
    await navigator.clipboard.writeText(tokenAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => navigate({ to: '/portal/stablecoins' })}
            className="p-1.5 -ml-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <h1 className="text-[15px] font-medium text-foreground">Loading...</h1>
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  // Not found state
  if (isNotFound) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => navigate({ to: '/portal/stablecoins' })}
            className="p-1.5 -ml-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <h1 className="text-[15px] font-medium text-foreground">Stablecoin</h1>
        </div>
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <CircleDollarSign className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Stablecoin Not Found</h2>
          <p className="text-muted-foreground mb-4">This stablecoin is not in your list</p>
          <Button onClick={() => navigate({ to: '/portal/stablecoins' })}>
            Back to Stablecoins
          </Button>
        </div>
      </div>
    );
  }

  const isPaused = stablecoin?.metadata?.paused;
  const decimals = stablecoin?.metadata?.decimals ?? 6;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => navigate({ to: '/portal/stablecoins' })}
          className="p-1.5 -ml-1.5 rounded-md hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <h1 className="text-[15px] font-medium text-foreground">My Stablecoins</h1>
      </div>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center">
              <CircleDollarSign className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">{stablecoin?.name}</h1>
                {isPaused && (
                  <span className="text-[11px] font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                    Paused
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-medium text-muted-foreground">
                  {stablecoin?.symbol}
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">{stablecoin?.currency}</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={copyAddress}
                  className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground font-mono transition-colors"
                >
                  {formatAddress(tokenAddress, 8)}
                  {copied ? (
                    <Check className="h-3 w-3 text-success" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
                <a
                  href={getExplorerTokenUrl(tokenAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] text-primary hover:text-primary/80 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button onClick={() => setActiveModal('mint')} className="flex-1 h-11">
            <Plus className="h-4 w-4 mr-2" /> Mint
          </Button>
          <Button
            onClick={() => setActiveModal('pause')}
            variant="outline"
            className="flex-1 h-11 bg-white"
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
        <div className="bg-white rounded-xl p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)]">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Total Supply
          </p>
          <p className="text-xl font-bold text-foreground mt-1">
            {stablecoin?.metadata?.totalSupply !== undefined
              ? formatAmount(stablecoin.metadata.totalSupply.toString(), decimals)
              : '—'}
          </p>
          <p className="text-[11px] text-muted-foreground">{stablecoin?.symbol}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)]">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Supply Cap
          </p>
          <p className="text-xl font-bold text-foreground mt-1">
            {stablecoin?.metadata?.supplyCap && !isUnlimitedSupply(stablecoin.metadata.supplyCap)
              ? formatAmount(stablecoin.metadata.supplyCap.toString(), decimals)
              : 'Unlimited'}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {stablecoin?.metadata?.supplyCap && !isUnlimitedSupply(stablecoin.metadata.supplyCap)
              ? stablecoin?.symbol
              : ''}
          </p>
        </div>
      </div>

      {/* Your Access */}
      <YourAccessCard tokenAddress={tokenAddress} />

      {/* Token Settings */}
      <div className="mb-6">
        <h2 className="text-[13px] font-semibold text-foreground mb-3">Token Settings</h2>
        <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] overflow-hidden">
          <SettingsRow
            icon={<Gauge className="h-4 w-4 text-blue-500" />}
            title="Set Supply Cap"
            description="Limit maximum token supply"
            onClick={() => setActiveModal('supply-cap')}
          />
          <SettingsRow
            icon={<UserPlus className="h-4 w-4 text-green-500" />}
            title="Grant Role"
            description="Give permissions to an address"
            onClick={() => setActiveModal('grant-role')}
          />
          <SettingsRow
            icon={<UserMinus className="h-4 w-4 text-rose-500" />}
            title="Revoke Role"
            description="Remove permissions from an address"
            onClick={() => setActiveModal('revoke-role')}
          />
          <SettingsRow
            icon={<Ban className="h-4 w-4 text-red-400" />}
            title="Burn Blocked"
            description="Burn tokens from a blocked address"
            onClick={() => setActiveModal('burn-blocked')}
            isLast
          />
        </div>
      </div>

      {/* Danger Zone */}
      <div>
        <h2 className="text-[13px] font-semibold text-foreground mb-3">Danger Zone</h2>
        <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] overflow-hidden">
          <SettingsRow
            icon={<Trash2 className="h-4 w-4 text-red-500" />}
            title="Remove from List"
            description="Remove from your local storage only"
            onClick={() => setActiveModal('remove')}
            variant="danger"
            isLast
          />
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

      <RemoveConfirmModal
        coin={activeModal === 'remove' ? (stablecoin ?? null) : null}
        onConfirm={handleRemove}
        onCancel={closeModal}
      />
    </div>
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
      className={`w-full flex items-center justify-between p-4 transition-colors ${
        variant === 'danger' ? 'hover:bg-red-50' : 'hover:bg-muted/50'
      } ${!isLast ? 'border-b border-[rgba(0,0,0,0.03)]' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            variant === 'danger' ? 'bg-red-50' : 'bg-primary/10'
          }`}
        >
          {icon}
        </div>
        <div className="text-left">
          <p
            className={`text-[13px] font-medium ${variant === 'danger' ? 'text-red-600' : 'text-foreground'}`}
          >
            {title}
          </p>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
