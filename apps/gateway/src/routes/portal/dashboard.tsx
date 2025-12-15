import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useRef, useEffect, type ReactElement } from 'react';
import {
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  Droplets,
  ArrowLeftRight,
  Loader2,
  Check,
  Clock,
  Users,
  Coins,
  Shield,
  ExternalLink,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTempo } from '@/hooks/useTempo';
import { useTokensWithBalances } from '@/hooks/useTokenList';
import { formatAmount, cn } from '@/lib/utils';
import { getTokenColors } from '@/lib/tokenlist';
import { fundFromFaucet } from '@/lib/tempo-client';
import { LINKS, TIMING } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/CopyButton';

export const Route = createFileRoute('/portal/dashboard')({
  component: DashboardPage,
});

// Pastel color palette for quick actions
const quickActions = [
  {
    icon: ArrowUpRight,
    label: 'Send',
    href: '/portal/send',
    bgColor: '#E0E7FF',
    iconColor: '#635bff',
  },
  {
    icon: ArrowDownLeft,
    label: 'Receive',
    href: '/portal/receive',
    bgColor: '#D1FAE5',
    iconColor: '#00a67e',
  },
  {
    icon: ArrowLeftRight,
    label: 'Swap',
    href: '/portal/swap',
    bgColor: '#FEF3C7',
    iconColor: '#f59e0b',
  },
  {
    icon: Droplets,
    label: 'Liquidity',
    href: '/portal/liquidity',
    bgColor: '#CFFAFE',
    iconColor: '#06b6d4',
  },
  {
    icon: Coins,
    label: 'TIP20 Studio',
    href: '/portal/tip20-studio',
    bgColor: '#FFEDD5',
    iconColor: '#f97316',
  },
  {
    icon: Shield,
    label: 'TIP403 Factory',
    href: '/portal/tip403-factory',
    bgColor: '#D1FAE5',
    iconColor: '#10b981',
  },
  {
    icon: Users,
    label: 'Contacts',
    href: '/portal/contacts',
    bgColor: '#FCE7F3',
    iconColor: '#db2777',
  },
  {
    icon: Clock,
    label: 'Scheduled',
    href: '/portal/scheduled',
    bgColor: '#EDE9FE',
    iconColor: '#8b5cf6',
  },
];

function DashboardPage(): ReactElement | null {
  const { address } = useTempo();
  const { tokens, totalBalance, isLoading, refetch } = useTokensWithBalances();
  const [isFunding, setIsFunding] = useState(false);
  const [fundingSuccess, setFundingSuccess] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!address) return null;

  const handleFaucet = async (): Promise<void> => {
    if (!address || isFunding) return;
    setIsFunding(true);
    setFundingSuccess(false);
    try {
      await fundFromFaucet(address);
      setFundingSuccess(true);
      toast.success('Tokens received! Refreshing balances...');
      // Refresh balances after a short delay
      timeoutRef.current = setTimeout(() => {
        refetch();
        setFundingSuccess(false);
      }, TIMING.FAUCET_REFRESH_DELAY_MS);
    } catch (err) {
      console.error('Faucet error:', err);
      toast.error('Failed to get tokens. Try again later.');
    } finally {
      setIsFunding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:items-stretch">
        {/* Left Column - Balance & Assets */}
        <div className="lg:col-span-3 space-y-6">
          {/* Balance Card */}
          <div className="bg-white rounded-2xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[12px] font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    Total Balance
                    {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  </p>
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 mb-3">
                    ${formatAmount(totalBalance.toString(), 6)}
                  </h1>
                  <div className="flex items-center gap-1">
                    <p className="text-[12px] font-mono text-gray-500 truncate">{address}</p>
                    <CopyButton value={address} />
                    <a
                      href={`${LINKS.explorer}/address/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
                <div
                  className="hidden sm:flex w-10 h-10 rounded-xl items-center justify-center"
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
              {isLoading && tokens.length === 0 ? (
                // Loading skeleton
                Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      'flex items-center justify-between px-4 py-3.5',
                      index < 3 && 'border-b border-gray-50'
                    )}
                  >
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
                ))
              ) : tokens.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-[13px] text-gray-500">No assets yet</p>
                  <p className="text-[12px] text-gray-400 mt-1">
                    Use the faucet to get test tokens
                  </p>
                </div>
              ) : (
                tokens.map((token, index) => {
                  const colors = getTokenColors(token.symbol);
                  const isLast = index === tokens.length - 1;

                  return (
                    <div
                      key={token.address}
                      className={cn(
                        'flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/50 transition-colors',
                        !isLast && 'border-b border-gray-50'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: colors.bg }}
                        >
                          <DollarSign className="h-5 w-5" style={{ color: colors.text }} />
                        </div>
                        <div>
                          <p className="text-[14px] font-medium text-gray-900">{token.symbol}</p>
                          <p className="text-[12px] text-gray-500">{token.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[14px] font-semibold text-gray-900 tabular-nums">
                          {formatAmount(token.balance.toString(), token.decimals)}
                        </p>
                        <p className="text-[12px] text-gray-500">{token.symbol}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Quick Actions */}
        <div className="lg:col-span-2 flex flex-col">
          <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden flex-1 flex flex-col">
            <div className="px-4 py-3.5 border-b border-gray-100">
              <h2 className="text-[13px] font-semibold text-gray-900">Quick Actions</h2>
            </div>
            <div className="p-3 flex-1 flex flex-col justify-center">
              <div className="grid grid-cols-2 gap-2">
                {quickActions.map(action => (
                  <Link
                    key={action.label}
                    to={action.href}
                    className="group flex flex-col items-center justify-center py-4 px-3 rounded-xl transition-all bg-slate-50 hover:bg-slate-100"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 mb-2"
                      style={{ backgroundColor: action.bgColor }}
                    >
                      <action.icon className="h-5 w-5" style={{ color: action.iconColor }} />
                    </div>
                    <p className="text-[12px] font-medium text-gray-700">{action.label}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
