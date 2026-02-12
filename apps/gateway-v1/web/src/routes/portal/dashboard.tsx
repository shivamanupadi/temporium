import { type ReactElement, useState, useCallback } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import {
  Send,
  QrCode,
  ArrowRightLeft,
  Copy,
  Check,
  Droplets,
  ExternalLink,
  DollarSign,
  Loader2,
  Wallet,
  BarChart3,
  Repeat,
  CircleDollarSign,
  Shield,
  Clock,
  Key,
  Users,
  Link2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useTempo } from '@/hooks/useTempo';
import { useTokensWithBalances } from '@/hooks/useTokenList';
import { getTokenColors } from '@/lib/tokenlist';
import { isTestnet, TIMING } from '@/lib/constants';
import { formatAmount, formatAddress, copyToClipboard, cn } from '@/lib/utils';
import { fundFromFaucet, getExplorerAddressUrl } from '@/lib/tempo-client';

export const Route = createFileRoute('/portal/dashboard')({
  component: DashboardPage,
});

/** Stagger children animations */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const } },
};

const quickActions = [
  {
    to: '/portal/send',
    label: 'Send',
    icon: Send,
    color: '#E07A5F',
    description: 'Transfer tokens',
  },
  {
    to: '/portal/receive',
    label: 'Receive',
    icon: QrCode,
    color: '#5B9A6F',
    description: 'Get your address',
  },
  {
    to: '/portal/swap',
    label: 'Swap',
    icon: ArrowRightLeft,
    color: '#9B72CF',
    description: 'Exchange tokens',
  },
  {
    to: '/portal/orderbook',
    label: 'Orderbook',
    icon: BarChart3,
    color: '#9B72CF',
    description: 'Limit orders',
  },
  {
    to: '/portal/exchange-balance',
    label: 'DEX Balance',
    icon: Wallet,
    color: '#9B72CF',
    description: 'Manage DEX funds',
  },
  {
    to: '/portal/pool-swap',
    label: 'Pool Swap',
    icon: Repeat,
    color: '#6B8EAD',
    description: 'AMM swap',
  },
  {
    to: '/portal/liquidity',
    label: 'Liquidity',
    icon: Droplets,
    color: '#6B8EAD',
    description: 'Provide liquidity',
  },
  {
    to: '/portal/tip20-studio',
    label: 'TIP20 Studio',
    icon: CircleDollarSign,
    color: '#E07A5F',
    description: 'Manage stablecoins',
  },
  {
    to: '/portal/tip403-factory',
    label: 'TIP403',
    icon: Shield,
    color: '#E07A5F',
    description: 'Transfer policies',
  },
  {
    to: '/portal/scheduled',
    label: 'Scheduled',
    icon: Clock,
    color: '#D4A574',
    description: 'Scheduled payments',
  },
  {
    to: '/portal/access-keys',
    label: 'Access Keys',
    icon: Key,
    color: '#D4A574',
    description: 'Manage keys',
  },
  {
    to: '/portal/contacts',
    label: 'Contacts',
    icon: Users,
    color: '#5B9A6F',
    description: 'Address book',
  },
  {
    to: '/portal/connected-apps',
    label: 'Apps',
    icon: Link2,
    color: '#5B9A6F',
    description: 'Connected apps',
  },
] as const;

function DashboardPage(): ReactElement {
  const { address } = useTempo();
  const { tokens, totalBalance, isLoading: isBalanceLoading, refetch } = useTokensWithBalances(address);

  const [copied, setCopied] = useState(false);
  const [isFaucetLoading, setIsFaucetLoading] = useState(false);

  const handleCopyAddress = useCallback(async (): Promise<void> => {
    if (!address) return;
    const success = await copyToClipboard(address);
    if (success) {
      setCopied(true);
      toast.success('Address copied to clipboard');
      setTimeout(() => setCopied(false), TIMING.COPY_FEEDBACK_MS);
    } else {
      toast.error('Failed to copy address');
    }
  }, [address]);

  const handleFaucet = useCallback(async (): Promise<void> => {
    if (!address) return;
    setIsFaucetLoading(true);
    try {
      await fundFromFaucet(address);
      toast.success('Testnet tokens received!', {
        description: 'Your balance will update shortly.',
      });
      setTimeout(() => refetch(), 2000);
    } catch (err) {
      toast.error('Faucet request failed', {
        description: (err as Error).message,
      });
    } finally {
      setIsFaucetLoading(false);
    }
  }, [address, refetch]);

  const explorerUrl = address ? getExplorerAddressUrl(address) : '';

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Welcome Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold text-[#2D3436] tracking-tight">Dashboard</h1>
        <p className="text-[14px] text-[#6B6560] mt-1">
          Welcome back. Here is your wallet overview.
        </p>
      </motion.div>

      {/* Two-column layout: stacks on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Balance & Address Card */}
          <motion.div
            variants={itemVariants}
            className="rounded-2xl border border-[#EDE9E3] bg-white p-6"
          >
            <div className="flex items-start justify-between mb-1">
              <p className="text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider">
                Total Balance
              </p>
              <div className="w-8 h-8 rounded-lg bg-[#E07A5F]/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-[#E07A5F]" />
              </div>
            </div>

            {isBalanceLoading && tokens.length === 0 ? (
              <div className="flex items-center gap-2 mt-3">
                <Loader2 className="w-5 h-5 animate-spin text-[#B5B0AA]" />
                <span className="text-[14px] text-[#9B9590]">Loading balance...</span>
              </div>
            ) : (
              <div className="mt-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[24px] font-semibold text-[#9B9590]">$</span>
                  <span className="text-[36px] font-bold text-[#2D3436] tracking-tight leading-tight">
                    {formatAmount(totalBalance, 6, 2)}
                  </span>
                </div>
                <p className="text-[12px] text-[#B5B0AA] mt-1">
                  Total balance across all stablecoins
                </p>
              </div>
            )}

            <div className="border-t border-[#EDE9E3]/60 mt-5 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#9B72CF]/10 flex items-center justify-center shrink-0">
                    <Wallet className="w-5 h-5 text-[#9B72CF]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                      Connected Address
                    </p>
                    <p className="text-[14px] font-mono font-medium text-[#2D3436] truncate">
                      {address ? formatAddress(address, 8) : '--'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyAddress}
                    className="w-9 h-9 rounded-lg text-[#9B9590] hover:text-[#2D3436] hover:bg-[#F5F2ED]"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-[#5B9A6F]" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                  {explorerUrl && (
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-[#9B9590] hover:text-[#2D3436] hover:bg-[#F5F2ED] transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Testnet Faucet */}
          <motion.div
            variants={itemVariants}
            className="rounded-2xl border border-dashed border-[#EDE9E3] bg-[#FDFBF8] p-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#5B9A6F]/10 flex items-center justify-center shrink-0">
                  <Droplets className="w-5 h-5 text-[#5B9A6F]" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#2D3436]">Testnet Faucet</p>
                  <p className="text-[12px] text-[#9B9590]">
                    Get free testnet tokens to try things out
                  </p>
                </div>
              </div>
              <Button
                onClick={handleFaucet}
                disabled={isFaucetLoading || !address}
                className="h-10 px-5 rounded-xl text-[13px] font-semibold bg-[#5B9A6F] hover:bg-[#4E8A62] text-white"
              >
                {isFaucetLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    Requesting...
                  </>
                ) : (
                  'Get Tokens'
                )}
              </Button>
            </div>
          </motion.div>

          {/* Assets */}
          <motion.div
            variants={itemVariants}
            className="rounded-2xl border border-[#EDE9E3] bg-white overflow-hidden"
          >
            <div className="px-5 py-4">
              <p className="text-[13px] font-semibold text-[#2D3436]">Assets</p>
            </div>

            <div className="mx-5 border-t border-[#EDE9E3]/60" />

            <div>
              {isBalanceLoading && tokens.length === 0 ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      'flex items-center justify-between px-5 py-4',
                      index < 2 && 'border-b border-[#EDE9E3]/40'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#F5F2ED] animate-pulse" />
                      <div>
                        <div className="h-4 w-16 bg-[#F5F2ED] rounded-md animate-pulse mb-1.5" />
                        <div className="h-3 w-24 bg-[#FAF8F5] rounded-md animate-pulse" />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="h-4 w-16 bg-[#F5F2ED] rounded-md animate-pulse mb-1.5" />
                      <div className="h-3 w-12 bg-[#FAF8F5] rounded-md animate-pulse" />
                    </div>
                  </div>
                ))
              ) : tokens.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#F5F2ED] flex items-center justify-center mx-auto mb-3">
                    <DollarSign className="w-6 h-6 text-[#B5B0AA]" />
                  </div>
                  <p className="text-[13px] font-medium text-[#6B6560]">No assets yet</p>
                  <p className="text-[12px] text-[#9B9590] mt-1">
                    {isTestnet ? 'Use the faucet to get test tokens' : 'Send tokens to get started'}
                  </p>
                </div>
              ) : (
                tokens.map((token, index) => {
                  const colors = getTokenColors(token.symbol);
                  const isLast = index === tokens.length - 1;

                  return (
                    <motion.div
                      key={token.address}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className={cn(
                        'flex items-center justify-between px-5 py-4 hover:bg-[#FDFBF8] transition-colors',
                        !isLast && 'border-b border-[#EDE9E3]/40'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden"
                          style={{ backgroundColor: colors.bg }}
                        >
                          {token.logoURI ? (
                            <img
                              src={token.logoURI}
                              alt={token.symbol}
                              className="w-10 h-10 rounded-xl object-cover"
                              onError={e => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <DollarSign
                            className={cn('h-5 w-5', token.logoURI && 'hidden')}
                            style={{ color: colors.text }}
                          />
                        </div>
                        <div>
                          <p className="text-[14px] font-semibold text-[#2D3436]">{token.symbol}</p>
                          <p className="text-[12px] text-[#9B9590]">{token.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[14px] font-semibold text-[#2D3436] tabular-nums">
                          {formatAmount(token.balance.toString(), token.decimals)}
                        </p>
                        <p className="text-[12px] text-[#9B9590]">{token.symbol}</p>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>

        {/* Right Column */}
        <div>
          {/* Quick Actions */}
          <motion.div variants={itemVariants}>
            <div className="grid grid-cols-3 gap-3">
              {quickActions.map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className="group"
                >
                  <motion.div
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                    className="rounded-2xl border border-dashed border-[#EDE9E3] bg-transparent p-4 text-center hover:shadow-sm transition-shadow"
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-2.5"
                      style={{ backgroundColor: `${action.color}12` }}
                    >
                      <action.icon
                        className="w-5 h-5"
                        style={{ color: action.color }}
                      />
                    </div>
                    <p className="text-[14px] font-semibold text-[#2D3436]">
                      {action.label}
                    </p>
                    <p className="text-[11px] text-[#9B9590] mt-0.5">
                      {action.description}
                    </p>
                  </motion.div>
                </Link>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
