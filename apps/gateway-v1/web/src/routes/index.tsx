import { type ReactElement, useState, useEffect, useCallback } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Fingerprint,
  Wallet,
  ArrowRight,
  Loader2,
  LayoutDashboard,
  Send,
  QrCode,
  ArrowRightLeft,
  Droplets,
  CircleDollarSign,
  Clock,
  Shield,
  Key,
  Users,
  Plus,
  ExternalLink,
  Database,
  Copy,
  Check,
  BarChart3,
  Repeat,
  Link2,
  Coins,
  type LucideIcon,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@temporium/shared-ui';
import { CreateWalletModal } from '@temporium/shared-ui';
import { useTempo } from '@/hooks/useTempo';
import { getWalletApiUrl, TEMPO_NETWORK } from '@/lib/api';
import { copyToClipboard } from '@/lib/utils';

export const Route = createFileRoute('/')({
  component: LandingPage,
});

const features = [
  {
    icon: LayoutDashboard,
    label: 'Dashboard',
    desc: 'Portfolio overview & analytics',
    color: '#9B72CF',
  },
  { icon: Send, label: 'Send', desc: 'Transfer tokens instantly', color: '#E07A5F' },
  { icon: QrCode, label: 'Receive', desc: 'Generate payment QR codes', color: '#5B9A6F' },
  { icon: ArrowRightLeft, label: 'Swap', desc: 'Exchange tokens seamlessly', color: '#D4A574' },
  { icon: Droplets, label: 'Liquidity', desc: 'Provide LP & earn fees', color: '#6BA3BE' },
  {
    icon: CircleDollarSign,
    label: 'TIP20 Studio',
    desc: 'Create & manage tokens',
    color: '#E07A5F',
  },
  { icon: Clock, label: 'Scheduled', desc: 'Recurring & timed payments', color: '#C27BA0' },
  {
    icon: Shield,
    label: 'TIP403 Factory',
    desc: 'Deploy access-controlled tokens',
    color: '#9B72CF',
  },
  { icon: Key, label: 'Access Keys', desc: 'Manage signing permissions', color: '#D4A574' },
  { icon: Users, label: 'Contacts', desc: 'Save & organize addresses', color: '#5B9A6F' },
];

interface FeatureDetail {
  icon: LucideIcon;
  title: string;
  desc: string;
  color: string;
}

const featureSections: {
  label: string;
  heading: string;
  subtitle: string;
  items: FeatureDetail[];
}[] = [
  {
    label: 'Payments',
    heading: 'Send & receive with ease',
    subtitle:
      'Transfer tokens to anyone, generate shareable QR codes, and automate recurring payments. All with sub-cent fees.',
    items: [
      {
        icon: Send,
        title: 'Instant Transfers',
        desc: 'Send tokens to any address in seconds. Enter an amount, pick a contact or paste an address, and confirm.',
        color: '#E07A5F',
      },
      {
        icon: QrCode,
        title: 'QR Receive',
        desc: 'Generate a payment QR code with a pre-filled amount. Share it with anyone for one-tap payments.',
        color: '#5B9A6F',
      },
      {
        icon: Clock,
        title: 'Scheduled Payments',
        desc: 'Set up one-time or recurring payments on a schedule. Payroll, subscriptions, and installments on autopilot.',
        color: '#9B72CF',
      },
    ],
  },
  {
    label: 'Trading',
    heading: 'Trade stablecoins on-chain',
    subtitle:
      'Swap between stablecoins via an orderbook DEX or automated market maker pools with deep liquidity and zero slippage risk.',
    items: [
      {
        icon: ArrowRightLeft,
        title: 'Stablecoin Swap',
        desc: 'Swap between USD, USDC, USDT, and other stablecoins through a high-performance on-chain orderbook.',
        color: '#D4A574',
      },
      {
        icon: BarChart3,
        title: 'Orderbook',
        desc: 'View real-time bids and asks. Place limit orders at your target price and let the matching engine handle the rest.',
        color: '#6BA3BE',
      },
      {
        icon: Repeat,
        title: 'Pool Swap',
        desc: 'Trade through AMM liquidity pools for guaranteed execution. Automatic routing picks the best available rate.',
        color: '#E07A5F',
      },
      {
        icon: Droplets,
        title: 'Provide Liquidity',
        desc: 'Deposit token pairs into AMM pools to earn trading fees. Withdraw your position and accumulated rewards anytime.',
        color: '#5B9A6F',
      },
    ],
  },
  {
    label: 'Token Tools',
    heading: 'Create & deploy tokens',
    subtitle:
      'Launch your own TIP20 tokens or deploy access-controlled TIP403 tokens. No coding required.',
    items: [
      {
        icon: CircleDollarSign,
        title: 'TIP20 Studio',
        desc: 'Create fungible tokens with custom name, symbol, supply, and decimals. Mint, burn, and manage directly from the dashboard.',
        color: '#E07A5F',
      },
      {
        icon: Shield,
        title: 'TIP403 Factory',
        desc: 'Deploy tokens with built-in access controls. Define policies for transfers, minting, and burning with granular permissions.',
        color: '#9B72CF',
      },
      {
        icon: Coins,
        title: 'Spending Limits',
        desc: 'Set per-token spending caps on access keys. Control exactly how much each key can spend without revoking access.',
        color: '#D4A574',
      },
    ],
  },
  {
    label: 'Security',
    heading: 'Secure & organized',
    subtitle:
      'Manage signing keys, save frequently used addresses, and keep track of connected dApps. All from one place.',
    items: [
      {
        icon: Key,
        title: 'Access Keys',
        desc: 'Generate sub-keys with custom expiry and spending limits. Authorize apps to sign on your behalf without exposing your main key.',
        color: '#D4A574',
      },
      {
        icon: Users,
        title: 'Contacts',
        desc: 'Save wallet addresses with names and labels. Pick contacts when sending instead of copy-pasting addresses every time.',
        color: '#5B9A6F',
      },
      {
        icon: Link2,
        title: 'Connected Apps',
        desc: 'See every app authorized to interact with your wallet. Revoke access instantly with a single click.',
        color: '#6BA3BE',
      },
    ],
  },
];

function LandingPage(): ReactElement {
  const navigate = useNavigate();
  const { isConnected, isConnecting, hasInjectedWallet, signUp, signIn, connectInjected } =
    useTempo();

  const [showSignIn, setShowSignIn] = useState(false);
  const [showCreateWallet, setShowCreateWallet] = useState(false);
  const [connectingType, setConnectingType] = useState<string | null>(null);
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [contractExplorerUrl, setContractExplorerUrl] = useState<string | null>(null);
  const [copiedContract, setCopiedContract] = useState(false);

  useEffect(() => {
    if (isConnected) {
      navigate({ to: '/portal/dashboard' });
    }
  }, [isConnected, navigate]);

  useEffect(() => {
    fetch(`${getWalletApiUrl()}/contracts`, {
      headers: { 'X-Tempo-Network': TEMPO_NETWORK },
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setContractAddress(data.data.contracts.passkeyRegistry.address);
          setContractExplorerUrl(data.data.contracts.passkeyRegistry.explorerUrl);
        }
      })
      .catch(() => {});
  }, []);

  const handleCopyContract = useCallback(async () => {
    if (!contractAddress) return;
    await copyToClipboard(contractAddress);
    setCopiedContract(true);
    setTimeout(() => setCopiedContract(false), 2000);
  }, [contractAddress]);

  const handleCreateWallet = async (walletName?: string): Promise<void> => {
    try {
      await signUp(walletName);
      setShowCreateWallet(false);
      toast.success('Wallet created successfully!');
    } catch (err) {
      toast.error('Failed to create wallet', { description: (err as Error).message });
    }
  };

  const handleSignIn = async (): Promise<void> => {
    setConnectingType('passkey');
    setShowSignIn(false);
    try {
      await signIn();
    } catch (err) {
      toast.error('Sign in failed', { description: (err as Error).message });
    } finally {
      setConnectingType(null);
    }
  };

  const handleConnectInjected = async (): Promise<void> => {
    setConnectingType('injected');
    setShowSignIn(false);
    try {
      await connectInjected();
    } catch (err) {
      toast.error('Connection failed', { description: (err as Error).message });
    } finally {
      setConnectingType(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF8] flex flex-col relative overflow-hidden">
      {/* Lightweight background — radial gradients only, no blur/filters */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 85% 15%, rgba(224,122,95,0.06) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 10% 85%, rgba(155,114,207,0.05) 0%, transparent 70%), radial-gradient(ellipse 40% 40% at 50% 50%, rgba(91,154,111,0.03) 0%, transparent 60%)',
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-5 flex items-center justify-between max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <img src="/logo-dark.png" alt="Temporium" className="w-8 h-8" />
          <span className="text-[17px] font-bold text-[#2D3436] tracking-tight">Temporium</span>
          <span className="text-[17px] font-medium text-[#B5B0AA] tracking-tight">| Gateway</span>
        </div>
        <div className="flex items-center gap-5">
          <a
            href="#how-it-works"
            onClick={e => {
              e.preventDefault();
              document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="text-[13px] font-medium text-[#6B6560] hover:text-[#2D3436] transition-colors"
          >
            How it works
          </a>
          <a
            href="#features"
            onClick={e => {
              e.preventDefault();
              document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="text-[13px] font-medium text-[#6B6560] hover:text-[#2D3436] transition-colors"
          >
            Features
          </a>
          <a
            href="https://x.com/HelloTemporium"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#6B6560] hover:text-[#2D3436] transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            @HelloTemporium
          </a>
        </div>
      </header>

      {/* Main content — 2-column layout */}
      <main className="relative z-10 flex-1 flex flex-col px-6">
        <div className="max-w-5xl w-full mx-auto flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center py-12 sm:py-16 lg:py-24">
          {/* ── Left: Hero ── */}
          <section className="flex flex-col items-center lg:items-start text-center lg:text-left py-8 lg:py-0">
            {/* Passkey badge */}
            <motion.a
              href="https://docs.tempo.xyz/guide/use-accounts/embed-passkeys#embed-passkey-accounts"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-[#EDE9E3] bg-white mb-8 shadow-xs hover:border-[#9B72CF]/30 hover:shadow-sm transition-all cursor-pointer"
            >
              <div className="w-[22px] h-[22px] rounded-full bg-gradient-to-br from-[#9B72CF]/15 to-[#9B72CF]/5 flex items-center justify-center">
                <Fingerprint className="h-3 w-3 text-[#9B72CF]" />
              </div>
              <span className="text-[12px] font-medium text-[#6B6560]">
                Learn about passkey wallets
              </span>
              <ExternalLink className="h-3 w-3 text-[#B5B0AA]" />
            </motion.a>

            {/* Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12, ease: [0.25, 0.1, 0.25, 1] }}
              className="mb-5"
            >
              <span className="block text-[40px] sm:text-[52px] lg:text-[60px] font-bold text-[#2D3436] leading-[1.05] tracking-[-0.03em]">
                Your{' '}
                <span className="relative inline-block">
                  <span className="relative z-10 text-[#E07A5F]">Gateway</span>
                  <motion.span
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.5, delay: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
                    className="absolute -bottom-1 left-0 right-0 h-[3px] bg-gradient-to-r from-[#E07A5F]/60 via-[#E07A5F]/40 to-transparent rounded-full origin-left"
                  />
                </span>
                <br />
                to Tempo
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.22 }}
              className="text-[15px] sm:text-[16px] text-[#8A8580] leading-relaxed mb-10 max-w-md"
            >
              Send, receive, swap, provide liquidity, create tokens, schedule payments, and manage
              access keys. All with sub-cent fees.
            </motion.p>

            {/* CTA buttons */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.32 }}
              className="flex items-center gap-3.5"
            >
              <Button
                onClick={() => setShowCreateWallet(true)}
                disabled={!!connectingType}
                className="h-[50px] px-7 rounded-2xl text-[14px] font-semibold bg-[#E07A5F] hover:bg-[#D4694F] text-white shadow-lg shadow-[#E07A5F]/15 hover:shadow-xl hover:shadow-[#E07A5F]/20 transition-all duration-300 hover:-translate-y-0.5"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Wallet
              </Button>

              <Button
                onClick={() => setShowSignIn(true)}
                disabled={!!connectingType}
                variant="outline"
                className="h-[50px] px-7 rounded-2xl text-[14px] font-semibold border-[#E2DDD6] bg-white hover:bg-[#FDFBF8] hover:border-[#D5D0C9] text-[#2D3436] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/[0.04]"
              >
                Sign In
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>

            {/* Loading state */}
            <AnimatePresence>
              {connectingType && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-6 flex items-center gap-2.5 text-[13px] text-[#9B9590]"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting...
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* ── Right: Feature grid ── */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.04, delayChildren: 0.35 },
              },
            }}
            className="flex flex-col"
          >
            {/* Section label */}
            <motion.p
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { duration: 0.4 } },
              }}
              className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-[0.12em] mb-4"
            >
              Built for Tempo
            </motion.p>

            {/* Feature cards — 2-column grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {features.map(f => (
                <motion.div
                  key={f.label}
                  variants={{
                    hidden: { opacity: 0, y: 14 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
                    },
                  }}
                  whileHover={{ y: -3, transition: { duration: 0.2, ease: 'easeOut' } }}
                  className="group relative rounded-2xl bg-white border border-[#EDE9E3]/80 p-4 cursor-default overflow-hidden transition-shadow duration-300 hover:shadow-lg hover:shadow-black/[0.04] hover:border-[#E2DDD6]"
                >
                  {/* Colored left accent — appears on hover */}
                  <div
                    className="absolute top-0 left-0 bottom-0 w-[2px] origin-top scale-y-0 group-hover:scale-y-100 transition-transform duration-300 ease-out"
                    style={{ backgroundColor: f.color }}
                  />

                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105"
                      style={{ backgroundColor: `${f.color}0F` }}
                    >
                      <f.icon
                        className="w-[17px] h-[17px]"
                        style={{ color: f.color }}
                        strokeWidth={1.7}
                      />
                    </div>

                    {/* Text */}
                    <div className="min-w-0 pt-0.5">
                      <p className="text-[13px] font-semibold text-[#2D3436] leading-tight">
                        {f.label}
                      </p>
                      <p className="text-[11px] text-[#9B9590] leading-snug mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </main>

      {/* How It Works */}
      <section
        id="how-it-works"
        className="relative z-10 border-t border-[#EDE9E3]/60 py-14 px-6 scroll-mt-6"
      >
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-[0.12em] mb-2">
              How It Works
            </p>
            <h2 className="text-[22px] sm:text-[26px] font-bold text-[#2D3436] tracking-tight mb-10">
              Passkey-secured wallets on Tempo
            </h2>
          </motion.div>

          {/* Steps */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: Fingerprint,
                title: 'Passkey Auth',
                desc: 'Sign in with Face ID, Touch ID, or your device PIN. No passwords or seed phrases to remember.',
                color: '#9B72CF',
                step: '01',
              },
              {
                icon: Database,
                title: 'On-Chain Storage',
                desc: 'Your public key is stored on the Tempo blockchain via a verified smart contract.',
                color: '#E07A5F',
                step: '02',
              },
              {
                icon: Shield,
                title: 'Permanent Access',
                desc: 'Recover your wallet anytime through the blockchain. Your key never leaves your device.',
                color: '#5B9A6F',
                step: '03',
              },
            ].map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="relative rounded-2xl border border-[#EDE9E3]/80 bg-white p-5 sm:p-6"
              >
                <span className="text-[11px] font-bold text-[#E2DDD6] tracking-wider">
                  {step.step}
                </span>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mt-3 mb-3"
                  style={{ backgroundColor: `${step.color}0F` }}
                >
                  <step.icon className="w-5 h-5" style={{ color: step.color }} strokeWidth={1.7} />
                </div>
                <h3 className="text-[14px] font-semibold text-[#2D3436] mb-1">{step.title}</h3>
                <p className="text-[13px] text-[#8A8580] leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Contract info */}
          {contractAddress && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="mt-6 rounded-2xl border border-[#EDE9E3]/80 bg-white p-5 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#9B72CF]/8 flex items-center justify-center shrink-0">
                  <Database className="w-4 h-4 text-[#9B72CF]" strokeWidth={1.7} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-wider">
                    Passkey Registry Contract
                  </p>
                  <p className="text-[13px] font-mono text-[#6B6560] truncate mt-0.5">
                    {contractAddress}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleCopyContract}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#EDE9E3] text-[12px] font-medium text-[#6B6560] hover:bg-[#F5F2ED] hover:text-[#2D3436] transition-all"
                >
                  {copiedContract ? (
                    <Check className="w-3.5 h-3.5 text-[#5B9A6F]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedContract ? 'Copied' : 'Copy'}
                </button>
                {contractExplorerUrl && (
                  <a
                    href={contractExplorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#EDE9E3] text-[12px] font-medium text-[#6B6560] hover:bg-[#F5F2ED] hover:text-[#2D3436] transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Explorer
                  </a>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="relative z-10 border-t border-[#EDE9E3]/60 py-16 px-6 scroll-mt-6"
      >
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5 }}
            className="text-center mb-14"
          >
            <p className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-[0.12em] mb-2">
              Features
            </p>
            <h2 className="text-[22px] sm:text-[26px] font-bold text-[#2D3436] tracking-tight mb-3">
              Everything you need, on-chain
            </h2>
            <p className="text-[14px] text-[#8A8580] max-w-lg mx-auto leading-relaxed">
              From payments to token creation, a complete toolkit for the Tempo blockchain.
            </p>
          </motion.div>

          <div className="space-y-20">
            {featureSections.map(section => (
              <div key={section.label}>
                {/* Section header */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.45 }}
                  className="mb-6"
                >
                  <p className="text-[10px] font-bold text-[#E07A5F] uppercase tracking-[0.14em] mb-1.5">
                    {section.label}
                  </p>
                  <h3 className="text-[18px] sm:text-[20px] font-bold text-[#2D3436] tracking-tight mb-1.5">
                    {section.heading}
                  </h3>
                  <p className="text-[13px] text-[#8A8580] leading-relaxed max-w-xl">
                    {section.subtitle}
                  </p>
                </motion.div>

                {/* Feature cards */}
                <div
                  className={`grid gap-3 ${section.items.length === 4 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`}
                >
                  {section.items.map((item, i) => (
                    <motion.div
                      key={item.title}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-30px' }}
                      transition={{ duration: 0.4, delay: i * 0.08, ease: [0.25, 0.1, 0.25, 1] }}
                      whileHover={{ y: -4, transition: { duration: 0.25, ease: 'easeOut' } }}
                      className="group relative rounded-2xl border border-[#EDE9E3]/80 bg-white p-5 overflow-hidden transition-shadow duration-300 hover:shadow-lg hover:shadow-black/[0.04] hover:border-[#E2DDD6]"
                    >
                      {/* Accent bar on hover */}
                      <div
                        className="absolute top-0 left-0 bottom-0 w-[2.5px] origin-top scale-y-0 group-hover:scale-y-100 transition-transform duration-300 ease-out rounded-full"
                        style={{ backgroundColor: item.color }}
                      />

                      {/* Icon */}
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center mb-3.5 transition-transform duration-300 group-hover:scale-110"
                        style={{ backgroundColor: `${item.color}0F` }}
                      >
                        <item.icon
                          className="w-5 h-5"
                          style={{ color: item.color }}
                          strokeWidth={1.7}
                        />
                      </div>

                      {/* Text */}
                      <h4 className="text-[14px] font-semibold text-[#2D3436] mb-1">
                        {item.title}
                      </h4>
                      <p className="text-[12px] text-[#8A8580] leading-relaxed">{item.desc}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#EDE9E3]/60 py-6 text-center">
        <p className="text-[11.5px] text-[#B5B0AA]">
          Powered by{' '}
          <a
            href="https://tempo.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#E07A5F] hover:text-[#D06A4F] transition-colors"
          >
            Tempo
          </a>
        </p>
      </footer>

      {/* Sign In Modal */}
      <Dialog open={showSignIn} onOpenChange={setShowSignIn}>
        <DialogContent className="max-w-[380px] p-0 gap-0 overflow-hidden rounded-2xl">
          <DialogTitle className="sr-only">Sign In</DialogTitle>
          <DialogDescription className="sr-only">
            Choose how to connect your wallet
          </DialogDescription>

          <div className="px-6 pt-6 pb-2">
            <h3 className="text-[16px] font-semibold text-[#2D3436] mb-1">Sign In</h3>
            <p className="text-[13px] text-[#6B6560]">Choose how to connect</p>
          </div>

          <div className="px-4 pb-5 space-y-2">
            {/* Passkey */}
            <button
              onClick={handleSignIn}
              disabled={!!connectingType}
              className="flex items-center gap-3.5 w-full p-3.5 rounded-xl border border-[#EDE9E3] hover:border-[#9B72CF]/30 hover:bg-[#9B72CF]/4 transition-all text-left group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-[#9B72CF]/10 flex items-center justify-center shrink-0">
                <Fingerprint className="w-5 h-5 text-[#9B72CF]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-[#2D3436]">Passkey</p>
                <p className="text-[12px] text-[#9B9590]">Sign in with Face ID or Touch ID</p>
              </div>
              {connectingType === 'passkey' ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#9B72CF]" />
              ) : (
                <ArrowRight className="w-4 h-4 text-[#B5B0AA] group-hover:text-[#9B72CF] transition-colors" />
              )}
            </button>

            {/* Browser Wallet */}
            <button
              onClick={handleConnectInjected}
              disabled={!!connectingType || !hasInjectedWallet}
              className={`flex items-center gap-3.5 w-full p-3.5 rounded-xl border border-[#EDE9E3] transition-all text-left group cursor-pointer ${
                hasInjectedWallet
                  ? 'hover:border-[#E07A5F]/30 hover:bg-[#E07A5F]/4'
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-[#E07A5F]/10 flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5 text-[#E07A5F]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-[#2D3436]">Browser Wallet</p>
                <p className="text-[12px] text-[#9B9590]">
                  {hasInjectedWallet ? 'Connect MetaMask, Brave, etc.' : 'No wallet detected'}
                </p>
              </div>
              {connectingType === 'injected' ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#E07A5F]" />
              ) : (
                <ArrowRight className="w-4 h-4 text-[#B5B0AA] group-hover:text-[#E07A5F] transition-colors" />
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Wallet Modal (shared component, uses Dialog) */}
      <CreateWalletModal
        isOpen={showCreateWallet}
        isLoading={isConnecting}
        onClose={() => setShowCreateWallet(false)}
        onCreateWallet={handleCreateWallet}
      />
    </div>
  );
}
