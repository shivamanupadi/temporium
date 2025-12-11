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
} from 'lucide-react';
import { toast } from 'sonner';
import { useTempo } from '@/hooks/useTempo';
import { useTokensWithBalances } from '@/hooks/useTokenList';
import { formatAmount, cn } from '@/lib/utils';
import { getTokenColors } from '@/lib/tokenlist';
import { fundFromFaucet } from '@/lib/tempo-client';
import { TIMING } from '@/lib/constants';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/portal/dashboard')({
  component: DashboardPage,
});

function DashboardPage(): ReactElement | null {
  const { address } = useTempo();
  const { tokens, totalBalance, isLoading, refetch } = useTokensWithBalances();
  const [isFunding, setIsFunding] = useState(false);
  const [fundingSuccess, setFundingSuccess] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!address) return null;

  const quickActions = [
    { icon: ArrowUpRight, label: 'Send', href: '/portal/send', color: '#635bff' },
    { icon: ArrowDownLeft, label: 'Receive', href: '/portal/receive', color: '#00a67e' },
    { icon: ArrowLeftRight, label: 'Swap', href: '/portal/swap', color: '#f59e0b' },
    { icon: Droplets, label: 'Liquidity', href: '/portal/liquidity', color: '#06b6d4' },
    { icon: Coins, label: 'Stablecoins', href: '/portal/stablecoins', color: '#f97316' },
    { icon: Users, label: 'Contacts', href: '/portal/contacts', color: '#64748b' },
    { icon: Clock, label: 'Scheduled', href: '/portal/scheduled', color: '#8b5cf6' },
  ];

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
    <div className="max-w-5xl mx-auto">
      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column - Balance & Assets */}
        <div className="lg:col-span-3 space-y-6">
          {/* Balance Hero */}
          <div className="bg-white rounded-2xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] p-8">
            <p className="text-[12px] font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              Total Balance
              {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            </p>
            <h1 className="text-5xl font-bold tracking-tight text-gray-900 mb-1">
              ${formatAmount(totalBalance.toString(), 6)}
            </h1>
            <p className="text-[13px] text-gray-400">USD equivalent</p>
          </div>

          {/* Assets */}
          <div>
            <h2 className="text-[13px] font-medium text-gray-500 uppercase tracking-wider mb-3 px-1">
              Assets
            </h2>
            <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] overflow-hidden">
              {isLoading && tokens.length === 0
                ? // Loading skeleton
                  Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className={cn(
                        'flex items-center justify-between px-4 py-3.5',
                        index < 3 && 'shadow-[0_1px_0_0_rgba(0,0,0,0.03)]'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gray-100 animate-pulse" />
                        <div>
                          <div className="h-4 w-16 bg-gray-100 rounded animate-pulse mb-1" />
                          <div className="h-3 w-12 bg-gray-50 rounded animate-pulse" />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="h-4 w-16 bg-gray-100 rounded animate-pulse mb-1" />
                        <div className="h-3 w-12 bg-gray-50 rounded animate-pulse" />
                      </div>
                    </div>
                  ))
                : tokens.map((token, index) => {
                    const colors = getTokenColors(token.symbol);
                    const isLast = index === tokens.length - 1;

                    return (
                      <div
                        key={token.address}
                        className={cn(
                          'flex items-center justify-between px-4 py-3.5',
                          !isLast && 'shadow-[0_1px_0_0_rgba(0,0,0,0.03)]'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: colors.bg }}
                          >
                            <DollarSign className="h-4 w-4" style={{ color: colors.text }} />
                          </div>
                          <div>
                            <p className="text-[13px] font-medium text-gray-900">{token.symbol}</p>
                            <p className="text-[11px] text-gray-500">{token.name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[14px] font-medium text-gray-900 tabular-nums">
                            {formatAmount(token.balance.toString(), token.decimals)}
                          </p>
                          <p className="text-[11px] text-gray-500">{token.symbol}</p>
                        </div>
                      </div>
                    );
                  })}
            </div>
          </div>
        </div>

        {/* Right Column - Actions & Faucet */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_1px_2px_-1px_rgba(0,0,0,0.03)] p-4">
            <h2 className="text-[13px] font-medium text-gray-500 uppercase tracking-wider mb-3">
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {quickActions.map(action => (
                <Link
                  key={action.label}
                  to={action.href}
                  className="group flex flex-col items-center justify-center h-20 rounded-xl bg-gray-50 hover:bg-gray-100 transition-all"
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 mb-1"
                    style={{ backgroundColor: `${action.color}15` }}
                  >
                    <action.icon className="h-4 w-4" style={{ color: action.color }} />
                  </div>
                  <p className="text-[11px] font-medium text-gray-700">{action.label}</p>
                </Link>
              ))}
            </div>

            {/* Faucet */}
            <div className="h-px bg-black/[0.03] mb-3" />
            <div>
              <Button
                onClick={handleFaucet}
                disabled={isFunding}
                variant="outline"
                className="w-full h-9 text-[12px]"
              >
                {isFunding ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Getting tokens...
                  </>
                ) : fundingSuccess ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-500" />
                    Tokens received!
                  </>
                ) : (
                  <>
                    <Droplets className="h-3.5 w-3.5" />
                    Get Free Testnet Tokens
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
