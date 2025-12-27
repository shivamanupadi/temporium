import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState, useEffect, type ReactElement } from 'react';
import { toast } from 'sonner';
import {
  Key,
  Fingerprint,
  Lock,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Loader2,
  Clock,
  Shield,
  ShieldOff,
  Coins,
  RefreshCw,
  Plus,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RevokeKeyModal, UpdateLimitsModal } from '@/components/access-keys';
import { useAccessKey } from '@/hooks/useAccessKeys';
import { useTokenList } from '@/hooks/useTokenList';
import { formatAddress } from '@/lib/utils';
import { formatExpiry, getKeyStatus, isKeyExpired } from '@/lib/access-keys-utils';
import { getExplorerAddressUrl } from '@/lib/tempo-client';
import type { Address } from 'viem';
import { formatUnits } from 'viem';

export const Route = createFileRoute('/portal/access-keys/$keyId')({
  component: AccessKeyDashboard,
});

type DashboardModal = 'revoke' | 'update-limits' | null;

interface SpendingLimitDisplay {
  token: Address;
  symbol: string;
  decimals: number;
  remaining: bigint;
  isLoading: boolean;
}

function AccessKeyDashboard(): ReactElement {
  const { keyId } = Route.useParams();
  const navigate = useNavigate();
  const { key, isLoading, getRemainingLimit, refresh } = useAccessKey(keyId as Address);
  const { tokens } = useTokenList();

  // Modal state
  const [activeModal, setActiveModal] = useState<DashboardModal>(null);

  // Copy state
  const [copied, setCopied] = useState(false);

  // Spending limits state
  const [spendingLimits, setSpendingLimits] = useState<SpendingLimitDisplay[]>([]);
  const [isLoadingLimits, setIsLoadingLimits] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [limitsRefreshKey, setLimitsRefreshKey] = useState(0);

  // Fetch spending limits for common tokens
  useEffect(() => {
    if (!key || !key.enforceLimits) {
      setSpendingLimits([]);
      return;
    }

    const fetchLimits = async (): Promise<void> => {
      setIsLoadingLimits(true);
      const limits: SpendingLimitDisplay[] = [];

      // Check limits for first 5 tokens from tokenlist
      const tokensToCheck = tokens.slice(0, 5);

      for (const token of tokensToCheck) {
        try {
          const remaining = await getRemainingLimit(keyId as Address, token.address as Address);
          if (remaining > 0n) {
            limits.push({
              token: token.address as Address,
              symbol: token.symbol,
              decimals: token.decimals,
              remaining,
              isLoading: false,
            });
          }
        } catch (error) {
          console.error(`Failed to get limit for ${token.symbol}:`, error);
        }
      }

      setSpendingLimits(limits);
      setIsLoadingLimits(false);
    };

    if (tokens.length > 0) {
      fetchLimits();
    }
  }, [key, keyId, tokens, getRemainingLimit, limitsRefreshKey]);

  const closeModal = (): void => {
    setActiveModal(null);
  };

  const handleSuccess = (): void => {
    refresh();
    setLimitsRefreshKey(prev => prev + 1);
    closeModal();
  };

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const copyKeyId = async (): Promise<void> => {
    await navigator.clipboard.writeText(keyId);
    setCopied(true);
    toast.success('Key ID copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const status = key ? getKeyStatus(key.isRevoked, key.expiry) : 'active';

  const getKeyTypeIcon = (): ReactElement => {
    switch (key?.signatureType) {
      case 'secp256k1':
        return <Key className="h-8 w-8 text-primary" />;
      case 'p256':
        return <Lock className="h-8 w-8 text-primary" />;
      case 'webAuthn':
        return <Fingerprint className="h-8 w-8 text-primary" />;
      default:
        return <Key className="h-8 w-8 text-primary" />;
    }
  };

  const getStatusBadge = (): ReactElement => {
    switch (status) {
      case 'active':
        return (
          <span className="text-[11px] font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
            Active
          </span>
        );
      case 'expired':
        return (
          <span className="text-[11px] font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
            Expired
          </span>
        );
      case 'revoked':
        return (
          <span className="text-[11px] font-medium text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">
            Revoked
          </span>
        );
    }
  };

  const getKeyTypeBadge = (): ReactElement => {
    const typeLabels: Record<string, string> = {
      secp256k1: 'Secp256k1',
      p256: 'P256',
      webAuthn: 'WebAuthn',
    };

    return (
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full text-primary bg-primary/10">
        {typeLabels[key?.signatureType ?? ''] ?? key?.signatureType}
      </span>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-5xl animate-pulse">
        {/* Header Skeleton */}
        <div className="flex items-center gap-2 mb-6">
          <div className="h-8 w-28 bg-muted rounded" />
          <span className="text-muted-foreground">/</span>
          <div className="h-8 w-32 bg-muted rounded" />
        </div>

        {/* Content Skeleton */}
        <div className="lg:flex lg:gap-6">
          <div className="lg:flex-[3]">
            <div className="rounded-2xl p-6 mb-6 bg-muted/30">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-muted" />
                  <div>
                    <div className="h-6 w-40 bg-muted rounded mb-2" />
                    <div className="h-4 w-32 bg-muted rounded" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="lg:flex-[2]">
            <div className="bg-muted/30 rounded-xl h-64" />
          </div>
        </div>
      </div>
    );
  }

  // Not found state
  if (!key) {
    return (
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Access Keys</h1>
        </div>
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Key className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Key Not Found</h2>
          <p className="text-muted-foreground mb-4">
            This access key does not exist or has been removed
          </p>
          <Button onClick={() => navigate({ to: '/portal/access-keys' })}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Access Keys
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <Link
            to="/portal/access-keys"
            className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-2xl font-bold">Access Keys</span>
          </Link>
          <span className="text-2xl text-slate-300">/</span>
          <span className="text-2xl font-bold text-slate-900 font-mono">
            {formatAddress(keyId, 6)}
          </span>
        </div>

        {/* Two Column Layout */}
        <div className="lg:flex lg:gap-6 lg:items-stretch">
          {/* Left Column - Main Content */}
          <div className="lg:flex-[3]">
            {/* Hero Section */}
            <div className="bg-primary/5 rounded-2xl p-6 mb-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                    {getKeyTypeIcon()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {getKeyTypeBadge()}
                      {getStatusBadge()}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={copyKeyId}
                        className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground font-mono transition-colors cursor-pointer"
                      >
                        {keyId}
                        {copied ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <a
                        href={getExplorerAddressUrl(keyId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12px] text-primary hover:text-primary/80 transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="h-8"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {/* Action Buttons */}
              {status === 'active' && (
                <div className="flex gap-3">
                  <Button onClick={() => setActiveModal('update-limits')} className="flex-1 h-11">
                    <Coins className="h-4 w-4 mr-2" /> Update Limits
                  </Button>
                  <Button
                    onClick={() => setActiveModal('revoke')}
                    variant="outline"
                    className="flex-1 h-11 bg-white text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Revoke Key
                  </Button>
                </div>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-xl p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)]">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Expiry
                  </p>
                </div>
                <p className="text-lg font-bold text-foreground">{formatExpiry(key.expiry)}</p>
                {key.expiry > 0 && !isKeyExpired(key.expiry) && (
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(key.expiry * 1000).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="bg-white rounded-xl p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)]">
                <div className="flex items-center gap-2 mb-2">
                  {key.enforceLimits ? (
                    <Shield className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <ShieldOff className="h-4 w-4 text-muted-foreground" />
                  )}
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Spending Limits
                  </p>
                </div>
                <p className="text-lg font-bold text-foreground">
                  {key.enforceLimits ? 'Enforced' : 'Not Enforced'}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {key.enforceLimits ? 'Per-token limits apply' : 'Unlimited spending'}
                </p>
              </div>
            </div>

            {/* Spending Limits Card - hidden for revoked keys */}
            {status !== 'revoked' && (
              <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.05)] flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold text-foreground">Spending Limits</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveModal('update-limits')}
                    className="h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Limit
                  </Button>
                </div>
                {isLoadingLimits ? (
                  <div className="p-8 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : spendingLimits.length === 0 ? (
                  <div className="p-8 text-center">
                    <Coins className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {key.enforceLimits ? 'No spending limits configured' : 'Limits not enforced'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {key.enforceLimits
                        ? 'Add token limits to control spending'
                        : 'This key has unlimited spending'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[rgba(0,0,0,0.03)]">
                    {spendingLimits.map(limit => (
                      <div key={limit.token} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Coins className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-[13px] font-medium text-foreground">
                              {limit.symbol}
                            </p>
                            <p className="text-[11px] text-muted-foreground font-mono">
                              {formatAddress(limit.token, 6)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[13px] font-medium text-foreground">
                            {formatUnits(limit.remaining, limit.decimals)} {limit.symbol}
                          </p>
                          <p className="text-[11px] text-muted-foreground">Remaining</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Key Details */}
          <div className="lg:flex-[2] mt-6 lg:mt-0">
            {/* Key Details Card */}
            <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[rgba(0,0,0,0.05)]">
                <h2 className="text-[13px] font-semibold text-foreground">Key Details</h2>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[12px] text-muted-foreground">Key ID</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-mono text-foreground">
                      {formatAddress(keyId, 8)}
                    </span>
                    <button
                      onClick={copyKeyId}
                      className="p-1 rounded hover:bg-muted transition-colors cursor-pointer"
                    >
                      {copied ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                    <a
                      href={getExplorerAddressUrl(keyId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded hover:bg-muted transition-colors"
                    >
                      <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                    </a>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[12px] text-muted-foreground">Signature Type</span>
                  <span className="text-[12px] font-medium text-foreground capitalize">
                    {key.signatureType}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[12px] text-muted-foreground">Status</span>
                  {getStatusBadge()}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[12px] text-muted-foreground">Enforce Limits</span>
                  <span className="text-[12px] font-medium text-foreground">
                    {key.enforceLimits ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[12px] text-muted-foreground">Expiry</span>
                  <span className="text-[12px] font-medium text-foreground">
                    {formatExpiry(key.expiry)}
                  </span>
                </div>
                {key.publicKeyHash && (
                  <div className="flex justify-between items-center">
                    <span className="text-[12px] text-muted-foreground">Public Key Hash</span>
                    <span className="text-[12px] font-mono text-foreground">
                      {formatAddress(key.publicKeyHash, 8)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <RevokeKeyModal
        isOpen={activeModal === 'revoke'}
        keyId={keyId as Address}
        onSuccess={() => {
          handleSuccess();
          navigate({ to: '/portal/access-keys' });
        }}
        onClose={closeModal}
      />

      <UpdateLimitsModal
        isOpen={activeModal === 'update-limits'}
        keyId={keyId as Address}
        onSuccess={handleSuccess}
        onClose={closeModal}
      />
    </>
  );
}
