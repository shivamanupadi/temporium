import { type ReactElement, useState, useEffect, useCallback, useRef } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
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
  ChevronRight,
  Wallet,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useTempo } from '@/hooks/useTempo';
import { useTokensWithBalances } from '@/hooks/useTokenList';
import { getExplorerAddressUrl, fundFromFaucet } from '@/lib/tempo-client';
import { getConnectedApps } from '@/lib/connected-apps';
import { getTokenColors } from '@/lib/tokenlist';
import { isTestnet, TIMING } from '@/lib/constants';
import { formatAmount, copyToClipboard, cn } from '@/lib/utils';
import type { ConnectedApp } from '@/types';

export const Route = createFileRoute('/wallet/')({
  component: DashboardPage,
});

// Quick actions with warm brand colors
const quickActions = [
  {
    icon: Send,
    label: 'Send',
    href: '/wallet/send',
    color: '#E07A5F',
  },
  {
    icon: ArrowDownLeft,
    label: 'Receive',
    href: '/wallet/receive',
    color: '#5B9A6F',
  },
  {
    icon: Clock,
    label: 'Activity',
    href: '/wallet/activity',
    color: '#9B72CF',
  },
  {
    icon: Users,
    label: 'Contacts',
    href: '/wallet/contacts',
    color: '#E07A5F',
  },
  {
    icon: Shield,
    label: 'Apps',
    href: '/wallet/apps',
    color: '#5B9A6F',
  },
  ...(isTestnet
    ? [
        {
          icon: Droplets,
          label: 'Faucet',
          href: '#faucet',
          color: '#ff9500',
        },
      ]
    : []),
];

function DashboardPage(): ReactElement {
  const { address } = useTempo();
  const { tokens, totalBalance, isLoading, refetch } = useTokensWithBalances();

  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [connectedApps, setConnectedApps] = useState<ConnectedApp[]>([]);
  const [isFunding, setIsFunding] = useState(false);
  const [fundingSuccess, setFundingSuccess] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const apps = getConnectedApps();
    setConnectedApps(apps);
  }, []);

  useEffect(() => {
    if (fundingSuccess) {
      const timeout = setTimeout(() => setFundingSuccess(false), TIMING.COPY_FEEDBACK_MS);
      return () => clearTimeout(timeout);
    }
  }, [fundingSuccess]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopyAddress = useCallback(async (): Promise<void> => {
    if (!address) return;
    const success = await copyToClipboard(address);
    if (success) {
      setCopied(true);
      toast.success('Address copied to clipboard');
      timeoutRef.current = setTimeout(() => setCopied(false), TIMING.COPY_FEEDBACK_MS);
    }
  }, [address]);

  const handleFaucet = useCallback(async (): Promise<void> => {
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
  }, [address, isFunding, refetch]);

  const handleQuickAction = (href: string): void => {
    if (href === '#faucet') {
      handleFaucet();
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-xl bg-[#E07A5F]/10 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-[#E07A5F]" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-[#2D3436]">Dashboard</h1>
          <p className="text-[13px] text-muted-foreground">Overview of your wallet</p>
        </div>
      </motion.div>

      {/* Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="relative bg-white border border-border/60 rounded-2xl shadow-sm overflow-hidden"
      >
        {/* Gradient wash */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#E07A5F]/[0.04] via-transparent to-[#9B72CF]/[0.03] pointer-events-none" />

        <div className="relative px-6 pt-6 pb-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              Total Balance
              {isLoading && <Loader2 className="h-3 w-3 animate-spin text-[#E07A5F]" />}
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#E07A5F]/8 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-[#E07A5F]" />
            </div>
          </div>

          <h2 className="text-[36px] font-bold tracking-tight text-[#2D3436] leading-none mb-4">
            <span className="text-[#9B9590] text-[24px] font-semibold mr-0.5">$</span>
            {formatAmount(totalBalance.toString(), 6)}
          </h2>

          {/* Address row */}
          <div className="flex items-center gap-2">
            <motion.button
              onClick={handleCopyAddress}
              whileTap={{ scale: 0.97 }}
              className="group flex items-center gap-2 bg-[#FDFBF8] hover:bg-[#F8F5F0] border border-border/30 hover:border-border/50 rounded-xl px-3 py-2 transition-all min-w-0"
            >
              <p className="font-mono text-[11px] text-[#6B6560] break-all leading-relaxed">
                {address}
              </p>
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.div
                    key="check"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  >
                    <Check className="h-3 w-3 text-[#5B9A6F]" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="copy"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Copy className="h-3 w-3 text-[#B5B0AA] group-hover:text-[#E07A5F] transition-colors" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>

            <button
              onClick={() => setShowQR(true)}
              className="w-8 h-8 rounded-lg border border-border/30 hover:border-[#9B72CF]/30 bg-[#FDFBF8] hover:bg-[#9B72CF]/[0.04] flex items-center justify-center transition-all group"
            >
              <QrCode className="h-3.5 w-3.5 text-[#B5B0AA] group-hover:text-[#9B72CF] transition-colors" />
            </button>

            <a
              href={getExplorerAddressUrl(address!)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-lg border border-border/30 hover:border-[#5B9A6F]/30 bg-[#FDFBF8] hover:bg-[#5B9A6F]/[0.04] flex items-center justify-center transition-all group"
            >
              <ExternalLink className="h-3.5 w-3.5 text-[#B5B0AA] group-hover:text-[#5B9A6F] transition-colors" />
            </a>
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid grid-cols-3 sm:grid-cols-6 gap-2"
      >
        {quickActions.map((action, i) =>
          action.href === '#faucet' ? (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.12 + i * 0.03 }}
              onClick={() => handleQuickAction(action.href)}
              disabled={isFunding}
              className="group flex flex-col items-center justify-center py-3.5 px-2 rounded-xl bg-white border border-border/40 hover:border-[color:var(--action-color)]/30 transition-all disabled:opacity-50"
              style={{ '--action-color': action.color } as React.CSSProperties}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-1.5 transition-transform group-hover:scale-110"
                style={{ backgroundColor: `${action.color}15` }}
              >
                {isFunding ? (
                  <Loader2 className="h-4 w-4 animate-spin" style={{ color: action.color }} />
                ) : (
                  <action.icon className="h-4 w-4" style={{ color: action.color }} />
                )}
              </div>
              <span className="text-[11px] font-medium text-[#4D5456]">
                {isFunding ? 'Loading...' : action.label}
              </span>
            </motion.button>
          ) : (
            <Link
              key={action.label}
              to={action.href}
              className="group flex flex-col items-center justify-center py-3.5 px-2 rounded-xl bg-white border border-border/40 hover:border-[color:var(--action-color)]/30 transition-all"
              style={{ '--action-color': action.color } as React.CSSProperties}
            >
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.12 + i * 0.03 }}
                className="flex flex-col items-center"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center mb-1.5 transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${action.color}15` }}
                >
                  <action.icon className="h-4 w-4" style={{ color: action.color }} />
                </div>
                <span className="text-[11px] font-medium text-[#4D5456]">{action.label}</span>
              </motion.div>
            </Link>
          )
        )}
      </motion.div>

      {/* Assets Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="bg-white border border-border/60 rounded-2xl shadow-sm overflow-hidden"
      >
        <div className="px-6 py-4 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-[#2D3436]">Assets</h2>
          {isTestnet && (
            <Button
              onClick={handleFaucet}
              disabled={isFunding}
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-[11px] font-semibold rounded-lg border-[#E07A5F]/25 text-[#E07A5F] hover:bg-[#E07A5F]/[0.04] hover:border-[#E07A5F]/40"
            >
              {isFunding ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  Getting...
                </>
              ) : fundingSuccess ? (
                <>
                  <Check className="h-3 w-3 text-[#5B9A6F] mr-1" />
                  Received!
                </>
              ) : (
                <>
                  <Droplets className="h-3 w-3 mr-1" />
                  Faucet
                </>
              )}
            </Button>
          )}
        </div>

        <div className="mx-6 border-t border-border/40" />

        <div>
          {isLoading && tokens.length === 0 ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-center justify-between px-6 py-4',
                  index < 3 && 'border-b border-border/20'
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
            <div className="px-6 py-10 text-center">
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
                    'flex items-center justify-between px-6 py-4 hover:bg-[#FDFBF8] transition-colors',
                    !isLast && 'border-b border-border/20'
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

      {/* Connected Apps Card */}
      <AnimatePresence>
        {connectedApps.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="bg-white border border-border/60 rounded-2xl shadow-sm overflow-hidden"
          >
            <div className="px-6 py-4 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-[#2D3436]">Connected Apps</h2>
              <Link to="/wallet/apps">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px] font-medium text-[#9B9590] hover:text-[#6B6560]"
                >
                  View all
                  <ChevronRight className="h-3 w-3 ml-0.5" />
                </Button>
              </Link>
            </div>

            <div className="mx-6 border-t border-border/40" />

            <div>
              {connectedApps.slice(0, 3).map((app, index) => {
                const isLast = index === Math.min(connectedApps.length - 1, 2);
                return (
                  <div
                    key={app.id}
                    className={cn(
                      'flex items-center gap-3 px-6 py-3.5 hover:bg-[#FDFBF8] transition-colors',
                      !isLast && 'border-b border-border/20'
                    )}
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#F5F2ED] flex items-center justify-center">
                      {app.icon ? (
                        <img src={app.icon} alt={app.name} className="w-5 h-5 rounded" />
                      ) : (
                        <Shield className="w-4 h-4 text-[#9B9590]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#2D3436] truncate">{app.name}</p>
                      <p className="text-[11px] text-[#9B9590] truncate">{app.url}</p>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-[#5B9A6F] font-medium">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#5B9A6F]" />
                      Connected
                    </div>
                  </div>
                );
              })}
              {connectedApps.length > 3 && (
                <div className="px-6 py-2.5 bg-[#FDFBF8] border-t border-border/20">
                  <p className="text-[11px] text-[#9B9590] text-center">
                    +{connectedApps.length - 3} more apps
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Code Dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-[320px] p-0 gap-0 overflow-hidden rounded-2xl">
          {/* Top section with QR */}
          <div className="relative px-6 pt-8 pb-6">
            {/* Gradient wash */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#9B72CF]/[0.04] via-[#E07A5F]/[0.02] to-transparent pointer-events-none" />

            {/* Dot pattern */}
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 1px 1px, currentColor 0.5px, transparent 0.5px)',
                  backgroundSize: '16px 16px',
                }}
              />
            </div>

            <div className="relative flex flex-col items-center">
              {/* QR with glow */}
              <div className="relative">
                <div className="absolute -inset-6 bg-gradient-to-br from-[#E07A5F]/12 via-[#9B72CF]/12 to-[#5B9A6F]/12 rounded-[28px] blur-2xl opacity-60" />
                <div className="relative p-4 bg-white rounded-2xl shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_4px_16px_-4px_rgba(0,0,0,0.08)]">
                  <QRCodeSVG
                    value={address!}
                    size={200}
                    level="H"
                    includeMargin={false}
                    bgColor="#ffffff"
                    fgColor="#2D3436"
                  />
                  {/* Center logo */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-11 h-11 bg-white rounded-xl shadow-sm border border-border/30 flex items-center justify-center">
                      <QrCode className="w-5 h-5 text-[#E07A5F]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Scan prompt */}
              <p className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-[0.15em] mt-5">
                Scan to send payment
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-5 border-t border-border/40" />

          {/* Address section */}
          <div className="px-5 pt-4 pb-5">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                Wallet Address
              </span>
              <div className="flex items-center gap-1 text-[10px] text-[#5B9A6F] font-medium">
                <Shield className="w-2.5 h-2.5" />
                Your address
              </div>
            </div>

            {/* Clickable address card */}
            <motion.button
              onClick={handleCopyAddress}
              whileTap={{ scale: 0.98 }}
              className="w-full group relative bg-[#FDFBF8] hover:bg-[#F8F5F0] rounded-xl px-3.5 py-3 transition-colors border border-border/20 hover:border-border/40 text-left mb-4"
            >
              <p className="font-mono text-[11px] text-[#4D5456] break-all leading-relaxed pr-8">
                {address}
              </p>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <AnimatePresence mode="wait">
                  {copied ? (
                    <motion.div
                      key="check"
                      initial={{ scale: 0, rotate: -30 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      className="w-7 h-7 bg-[#5B9A6F]/12 rounded-lg flex items-center justify-center"
                    >
                      <Check className="w-3.5 h-3.5 text-[#5B9A6F]" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="copy"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="w-7 h-7 bg-white shadow-sm border border-border/20 rounded-lg flex items-center justify-center group-hover:bg-[#E07A5F] group-hover:border-[#E07A5F] group-hover:shadow-md transition-all"
                    >
                      <Copy className="w-3 h-3 text-muted-foreground/50 group-hover:text-white transition-colors" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.button>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-10 rounded-xl border-border/40 hover:border-[#E07A5F]/30 hover:bg-[#E07A5F]/[0.04] transition-all group text-[12px] font-semibold"
                onClick={handleCopyAddress}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 mr-1.5 text-[#5B9A6F]" />
                ) : (
                  <Copy className="h-3.5 w-3.5 mr-1.5 text-muted-foreground group-hover:text-[#E07A5F] transition-colors" />
                )}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              <Button
                variant="outline"
                className="h-10 rounded-xl border-border/40 hover:border-[#5B9A6F]/30 hover:bg-[#5B9A6F]/[0.04] transition-all group text-[12px] font-semibold"
                onClick={() => window.open(getExplorerAddressUrl(address!), '_blank')}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5 text-muted-foreground group-hover:text-[#5B9A6F] transition-colors" />
                Explorer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
