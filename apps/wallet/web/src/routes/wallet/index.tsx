import { type ReactElement, useState, useEffect } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import {
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Droplets,
  Send,
  ArrowDownLeft,
  Clock,
  Users,
  Shield,
  TrendingUp,
  Loader2,
  DollarSign,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTempo } from '@/hooks/useTempo';
import { getExplorerAddressUrl, fundFromFaucet } from '@/lib/tempo-client';
import { getConnectedApps } from '@/lib/connected-apps';
import { formatAmount, copyToClipboard, cn } from '@/lib/utils';
import { DEFAULT_FEE_TOKEN_ADDRESS } from '@/lib/constants';
import type { ConnectedApp } from '@/types';

export const Route = createFileRoute('/wallet/')({
  component: DashboardPage,
});

// Quick actions with pastel colors
const quickActions = [
  {
    icon: Send,
    label: 'Send',
    href: '/wallet/send',
    bgColor: '#E0E7FF',
    iconColor: '#7c5cff',
  },
  {
    icon: ArrowDownLeft,
    label: 'Receive',
    href: '/wallet/receive',
    bgColor: '#D1FAE5',
    iconColor: '#00a67e',
  },
  {
    icon: Clock,
    label: 'Activity',
    href: '/wallet/activity',
    bgColor: '#EDE9FE',
    iconColor: '#8b5cf6',
  },
  {
    icon: Users,
    label: 'Contacts',
    href: '/wallet/contacts',
    bgColor: '#FCE7F3',
    iconColor: '#db2777',
  },
  {
    icon: Shield,
    label: 'Apps',
    href: '/wallet/apps',
    bgColor: '#CFFAFE',
    iconColor: '#06b6d4',
  },
  {
    icon: Droplets,
    label: 'Faucet',
    href: '#faucet',
    bgColor: '#FEF3C7',
    iconColor: '#f59e0b',
  },
];

function DashboardPage(): ReactElement {
  const { address } = useTempo();

  const {
    data: rawBalance,
    isLoading,
    refetch,
  } = useReadContract({
    address: DEFAULT_FEE_TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const balance = rawBalance ? { value: rawBalance, decimals: 6 } : undefined;

  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [connectedApps, setConnectedApps] = useState<ConnectedApp[]>([]);
  const [isFunding, setIsFunding] = useState(false);
  const [fundingSuccess, setFundingSuccess] = useState(false);

  // Load connected apps
  useEffect(() => {
    const apps = getConnectedApps();
    setConnectedApps(apps);
  }, []);

  // Reset funding success state
  useEffect(() => {
    if (fundingSuccess) {
      const timeout = setTimeout(() => setFundingSuccess(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [fundingSuccess]);

  const handleCopyAddress = async (): Promise<void> => {
    if (!address) return;
    const success = await copyToClipboard(address);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleFaucet = async (): Promise<void> => {
    if (!address || isFunding) return;

    setIsFunding(true);
    try {
      await fundFromFaucet(address);
      setFundingSuccess(true);
      toast.success('Tokens received! Refreshing balances...');
      refetch();
    } catch (error) {
      console.error('Faucet failed:', error);
      toast.error('Faucet request failed');
    } finally {
      setIsFunding(false);
    }
  };

  const handleQuickAction = (href: string): void => {
    if (href === '#faucet') {
      handleFaucet();
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Dashboard</h1>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6 lg:items-stretch">
        {/* Left Column - Balance & Assets */}
        <div className="lg:col-span-3 space-y-4 sm:space-y-6">
          {/* Balance Card */}
          <div className="bg-white rounded-2xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="p-4 sm:p-6">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] sm:text-[12px] font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    Total Balance
                    {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  </p>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-gray-900 mb-2 sm:mb-3">
                    ${balance ? formatAmount(balance.value, balance.decimals, 2) : '0.00'}
                  </h1>
                  <div className="flex items-center gap-1 min-w-0">
                    <p className="text-[10px] sm:text-[12px] font-mono text-gray-500 truncate">
                      {address}
                    </p>
                    <button
                      onClick={handleCopyAddress}
                      className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                    >
                      {copied ? (
                        <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => setShowQR(true)}
                      className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                    >
                      <QrCode className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </button>
                    <a
                      href={getExplorerAddressUrl(address!)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                    >
                      <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </a>
                  </div>
                </div>
                <div
                  className="hidden sm:flex w-10 h-10 rounded-xl items-center justify-center shrink-0 ml-4"
                  style={{ backgroundColor: '#EDE9FE' }}
                >
                  <TrendingUp className="h-5 w-5" style={{ color: '#7C3AED' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Assets Card */}
          <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-gray-900">Assets</h2>
              <Button
                onClick={handleFaucet}
                disabled={isFunding}
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-[12px] font-medium border-primary text-primary hover:bg-primary/5"
              >
                {isFunding ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    Getting...
                  </>
                ) : fundingSuccess ? (
                  <>
                    <Check className="h-3 w-3 text-green-500 mr-1" />
                    Received!
                  </>
                ) : (
                  <>
                    <Droplets className="h-3 w-3 mr-1" />
                    Faucet
                  </>
                )}
              </Button>
            </div>
            <div>
              {isLoading ? (
                // Loading skeleton
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 animate-pulse" />
                    <div>
                      <div className="h-4 w-16 bg-gray-100 rounded animate-pulse mb-1.5" />
                      <div className="h-3 w-20 bg-gray-50 rounded animate-pulse" />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="h-4 w-16 bg-gray-100 rounded animate-pulse mb-1.5" />
                    <div className="h-3 w-12 bg-gray-50 rounded animate-pulse" />
                  </div>
                </div>
              ) : !balance || balance.value === BigInt(0) ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-[13px] text-gray-500">No assets yet</p>
                  <p className="text-[12px] text-gray-400 mt-1">
                    Use the faucet to get test tokens
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: '#D1FAE5' }}
                    >
                      <DollarSign className="h-5 w-5" style={{ color: '#059669' }} />
                    </div>
                    <div>
                      <p className="text-[14px] font-medium text-gray-900">USD</p>
                      <p className="text-[12px] text-gray-500">USD Stablecoin</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[14px] font-semibold text-gray-900 tabular-nums">
                      {formatAmount(balance.value, balance.decimals)}
                    </p>
                    <p className="text-[12px] text-gray-500">USD</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Connected Apps Card */}
          {connectedApps.length > 0 && (
            <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-gray-900">Connected Apps</h2>
                <Link to="/wallet/apps">
                  <Button variant="ghost" size="sm" className="h-7 px-2.5 text-[12px] font-medium">
                    View all
                  </Button>
                </Link>
              </div>
              <div>
                {connectedApps.slice(0, 3).map((app, index) => {
                  const isLast = index === Math.min(connectedApps.length - 1, 2);
                  return (
                    <div
                      key={app.id}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors',
                        !isLast && 'border-b border-gray-50'
                      )}
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: '#F1F5F9' }}
                      >
                        {app.icon ? (
                          <img src={app.icon} alt={app.name} className="w-5 h-5" />
                        ) : (
                          <Shield className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-gray-900 truncate">{app.name}</p>
                        <p className="text-[11px] text-gray-500 truncate">{app.url}</p>
                      </div>
                    </div>
                  );
                })}
                {connectedApps.length > 3 && (
                  <div className="px-4 py-2.5 bg-gray-50/50 border-t border-gray-100">
                    <p className="text-[11px] text-gray-500 text-center">
                      +{connectedApps.length - 3} more apps
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Quick Actions */}
        <div className="lg:col-span-2 flex flex-col">
          <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden flex-1 flex flex-col">
            <div className="px-3 sm:px-4 py-3 sm:py-3.5 border-b border-gray-100">
              <h2 className="text-[12px] sm:text-[13px] font-semibold text-gray-900">
                Quick Actions
              </h2>
            </div>
            <div className="p-2 sm:p-3 flex-1 flex flex-col justify-center">
              <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-2 gap-1.5 sm:gap-2">
                {quickActions.map(action =>
                  action.href === '#faucet' ? (
                    <button
                      key={action.label}
                      onClick={() => handleQuickAction(action.href)}
                      disabled={isFunding}
                      className="group flex flex-col items-center justify-center py-2.5 sm:py-4 px-2 sm:px-3 rounded-lg sm:rounded-xl transition-all bg-slate-50 hover:bg-slate-100 disabled:opacity-50"
                    >
                      <div
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 mb-1 sm:mb-2"
                        style={{ backgroundColor: action.bgColor }}
                      >
                        {isFunding ? (
                          <Loader2
                            className="h-4 w-4 sm:h-5 sm:w-5 animate-spin"
                            style={{ color: action.iconColor }}
                          />
                        ) : (
                          <action.icon
                            className="h-4 w-4 sm:h-5 sm:w-5"
                            style={{ color: action.iconColor }}
                          />
                        )}
                      </div>
                      <p className="text-[10px] sm:text-[12px] font-medium text-gray-700 text-center leading-tight">
                        {isFunding ? 'Loading...' : action.label}
                      </p>
                    </button>
                  ) : (
                    <Link
                      key={action.label}
                      to={action.href}
                      className="group flex flex-col items-center justify-center py-2.5 sm:py-4 px-2 sm:px-3 rounded-lg sm:rounded-xl transition-all bg-slate-50 hover:bg-slate-100"
                    >
                      <div
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 mb-1 sm:mb-2"
                        style={{ backgroundColor: action.bgColor }}
                      >
                        <action.icon
                          className="h-4 w-4 sm:h-5 sm:w-5"
                          style={{ color: action.iconColor }}
                        />
                      </div>
                      <p className="text-[10px] sm:text-[12px] font-medium text-gray-700 text-center leading-tight">
                        {action.label}
                      </p>
                    </Link>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-xs">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-center">Your Address</DialogTitle>
          </DialogHeader>
          <div className="p-6 flex flex-col items-center">
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <QRCodeSVG value={address!} size={180} />
            </div>
            <p className="mt-4 text-[11px] font-mono text-gray-500 text-center break-all leading-relaxed">
              {address}
            </p>
            <Button className="w-full mt-4" onClick={handleCopyAddress}>
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Address
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
