import { type ReactElement, useState, useCallback } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import {
  Send,
  QrCode,
  Copy,
  Check,
  Droplets,
  ExternalLink,
  DollarSign,
  Loader2,
  Wallet,
  Repeat,
  CircleDollarSign,
  Shield,
  Clock,
  Key,
  Users,
  ShieldCheck,
  Gift,
  ListPlus,
  RefreshCw,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { ReceiveModal } from '@/components/ReceiveModal';
import { useTempo } from '@/hooks/useTempo';
import { useTokensWithBalances } from '@/hooks/useTokenList';
import { getTokenColors } from '@/lib/tokenlist';
import { isTestnet, TIMING, LINKS } from '@/lib/constants';
import { formatAmount, formatAddress, copyToClipboard, cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
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
  { to: '/portal/send', label: 'Send', icon: Send },
  { to: '/portal/receive', label: 'Receive', icon: QrCode },
  { to: '/portal/batch-payments', label: 'Batch', icon: ListPlus },
  { to: '/portal/recurring-payments', label: 'Recurring', icon: RefreshCw },
  { to: '/portal/scheduled-payments', label: 'Scheduled', icon: Clock },
  { to: '/portal/tip20-studio', label: 'TIP20', icon: CircleDollarSign },
  { to: '/portal/rewards', label: 'Rewards', icon: Gift },
  { to: '/portal/tip403-factory', label: 'TIP403', icon: Shield },
  { to: '/portal/access-keys', label: 'Keys', icon: Key },
  { to: '/portal/token-approvals', label: 'Approvals', icon: ShieldCheck },
  { to: '/portal/fee-amm-swap', label: 'Swap', icon: Repeat },
  { to: '/portal/fee-amm-liquidity', label: 'Liquidity', icon: Droplets },
  { to: '/portal/contacts', label: 'Contacts', icon: Users },
] as const;

function DashboardPage(): ReactElement {
  const { address } = useTempo();
  const {
    tokens,
    totalBalance,
    isLoading: isBalanceLoading,
    refetch,
  } = useTokensWithBalances(address);

  const [copied, setCopied] = useState(false);
  const [isFaucetLoading, setIsFaucetLoading] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-start">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Balance & Address Card */}
          <motion.div
            variants={itemVariants}
            className="rounded-2xl border border-[#EDE9E3] bg-white p-6"
          >
            <div className="mb-1">
              <p className="text-[12px] font-semibold text-[#9B9590] uppercase tracking-wider">
                Total Balance
              </p>
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
                    {formatAmount(totalBalance, 6)}
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
                  <div className="w-10 h-10 rounded-xl bg-[#E07A5F]/10 flex items-center justify-center shrink-0">
                    <Wallet className="w-5 h-5 text-[#E07A5F]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider">
                      Connected Address
                    </p>
                    <p className="text-[14px] font-mono font-medium text-[#2D3436] truncate">
                      {address ? formatAddress(address, 8) : '–'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setShowQrModal(true)}
                        className="w-8 h-8 rounded-full bg-[#F5F2ED] flex items-center justify-center text-[#6B6560] hover:bg-[#EDE9E3] transition-colors"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Receive</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleCopyAddress}
                        className="w-8 h-8 rounded-full bg-[#F5F2ED] flex items-center justify-center text-[#6B6560] hover:bg-[#EDE9E3] transition-colors"
                      >
                        {copied ? (
                          <Check className="w-3.5 h-3.5 text-[#6B8F71]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{copied ? 'Copied!' : 'Copy address'}</TooltipContent>
                  </Tooltip>
                  {explorerUrl && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 rounded-full bg-[#F5F2ED] flex items-center justify-center text-[#6B6560] hover:bg-[#EDE9E3] transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>View on Explorer</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Testnet Faucet */}
          {isTestnet && (
            <motion.div
              variants={itemVariants}
              className="rounded-2xl border border-[#EDE9E3] bg-white p-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#6B8F71]/10 flex items-center justify-center shrink-0">
                    <Droplets className="w-5 h-5 text-[#6B8F71]" />
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
                  className="h-10 px-5 rounded-xl text-[13px] font-semibold bg-[#6B8F71] hover:bg-[#5A7D60] text-white"
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
          )}

          {/* Quick Actions */}
          <motion.div
            variants={itemVariants}
            className="rounded-2xl border border-[#EDE9E3] bg-white p-5"
          >
            <p className="text-[13px] font-semibold text-[#2D3436] mb-4">Quick Actions</p>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-y-5 gap-x-2">
              {quickActions.map(action => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.to}
                    to={action.to}
                    className="group flex flex-col items-center gap-1.5"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#F5F2ED] group-hover:bg-[#6B8F71]/10 flex items-center justify-center transition-colors">
                      <Icon
                        className="w-[18px] h-[18px] text-[#6B6560] group-hover:text-[#6B8F71] transition-colors"
                        strokeWidth={1.75}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-[#6B6560] text-center leading-tight">
                      {action.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* Right Column — Assets */}
        <div className="lg:sticky lg:top-0 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
          <motion.div
            variants={itemVariants}
            className="rounded-2xl border border-[#EDE9E3] bg-white"
          >
            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-[#2D3436]">Assets</p>
              {tokens.length > 0 && (
                <span className="text-[11px] font-medium text-[#B5B0AA] bg-[#F5F2ED] px-2 py-0.5 rounded-full">
                  {tokens.length}
                </span>
              )}
            </div>

            {/* Token list */}
            {isBalanceLoading && tokens.length === 0 ? (
              <div className="px-5 pb-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-3 border-t border-[#F5F2ED]">
                    <div className="w-8 h-8 rounded-full bg-[#F5F2ED] animate-pulse shrink-0" />
                    <div className="flex-1">
                      <div className="h-3.5 w-12 bg-[#F5F2ED] rounded animate-pulse" />
                    </div>
                    <div className="h-3.5 w-20 bg-[#F5F2ED] rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : tokens.length === 0 ? (
              <div className="px-5 pb-8 pt-4 text-center border-t border-[#F5F2ED]">
                <p className="text-[13px] text-[#9B9590]">No assets yet</p>
                <p className="text-[12px] text-[#B5B0AA] mt-0.5">
                  {isTestnet ? 'Use the faucet above' : 'Send tokens to get started'}
                </p>
              </div>
            ) : (
              <div className="px-5 pb-2">
                {tokens.map((token, index) => {
                  const colors = getTokenColors(token.symbol);
                  return (
                    <motion.div
                      key={token.address}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.25, delay: index * 0.03 }}
                      className={cn(
                        'group flex items-center gap-3 py-3',
                        index > 0 && 'border-t border-[#F5F2ED]'
                      )}
                    >
                      {/* Icon */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden shrink-0"
                        style={{ backgroundColor: colors.bg }}
                      >
                        {token.logoURI ? (
                          <img
                            src={token.logoURI}
                            alt={token.symbol}
                            className="w-8 h-8 rounded-full object-cover"
                            onError={e => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <DollarSign
                          className={cn('h-3.5 w-3.5', token.logoURI && 'hidden')}
                          style={{ color: colors.text }}
                        />
                      </div>

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#2D3436] leading-none">
                          {token.symbol}
                        </p>
                        <p className="text-[11px] text-[#B5B0AA] mt-0.5 leading-none truncate">
                          {token.name}
                        </p>
                      </div>

                      {/* Balance */}
                      <p className="text-[13px] font-semibold text-[#2D3436] tabular-nums shrink-0">
                        <span className="text-[#9B9590] font-normal">$</span>
                        {formatAmount(token.balance.toString(), token.decimals)}
                      </p>

                      <a
                        href={`${LINKS.explorer}/token/${token.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-[#B5B0AA] hover:text-[#6B6560] transition-colors shrink-0"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      <ReceiveModal open={showQrModal} onOpenChange={setShowQrModal} address={address} />
    </motion.div>
  );
}
