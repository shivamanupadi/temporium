import { type ReactElement, useState, useEffect, useCallback } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Fingerprint,
  Globe,
  ArrowRight,
  ArrowDownUp,
  Loader2,
  PenLine,
  LayoutDashboard,
  Send,
  QrCode,
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
  Coins,
  ShieldCheck,
  Gift,
  ListPlus,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@temporium/shared-ui';
import { CreateWalletModal } from '@temporium/shared-ui';
import { useTempo } from '@/hooks/useTempo';
import { getWalletApiUrl } from '@/lib/api';
import { copyToClipboard } from '@/lib/utils';
import { isAccessTokenExpired } from '@/lib/auth-storage';
import { isDevMode, TEMPO_NETWORK } from '@/lib/constants';

export const Route = createFileRoute('/')({
  component: LandingPage,
});

// ---------------------------------------------------------------------------
// Tempo Wallet Connect Modal (public users)
// ---------------------------------------------------------------------------

type TempoStep = 'network' | 'connecting' | 'verify' | 'success';

const NETWORKS = [
  {
    id: 'mainnet' as const,
    name: 'Tempo Mainnet',
    subtitle: 'Production network',
    color: '#6B8F71',
  },
  {
    id: 'testnet' as const,
    name: 'Tempo Testnet',
    subtitle: 'Moderato (test network)',
    color: '#E07A5F',
  },
];

function TempoConnectModal({
  isOpen,
  onClose,
  connectTempoWallet,
  signTempoWallet,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  connectTempoWallet: (chainId?: number) => Promise<unknown>;
  signTempoWallet: (chainId?: number) => Promise<void>;
  onSuccess: (network: 'testnet' | 'mainnet') => void;
}): ReactElement {
  const [step, setStep] = useState<TempoStep>('network');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<'testnet' | 'mainnet'>(TEMPO_NETWORK);

  const handleSelectNetwork = useCallback(
    async (network: 'testnet' | 'mainnet') => {
      setSelectedNetwork(network);
      setStep('connecting');
      setIsLoading(true);
      setError(null);

      const chainId = network === 'mainnet' ? 4217 : 42431;
      try {
        await connectTempoWallet(chainId);
        setStep('verify');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Connection failed');
        setStep('network');
      } finally {
        setIsLoading(false);
      }
    },
    [connectTempoWallet, signTempoWallet, onSuccess]
  );

  const selectedChainId = selectedNetwork === 'mainnet' ? 4217 : 42431;

  const handleVerify = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signTempoWallet(selectedChainId);
      setStep('success');
      setTimeout(() => onSuccess(selectedNetwork), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  }, [signTempoWallet, onSuccess, selectedNetwork]);

  const handleClose = useCallback(
    (open: boolean) => {
      if (!open && !isLoading) {
        onClose();
        setTimeout(() => {
          setStep('network');
          setError(null);
        }, 200);
      }
    },
    [isLoading, onClose]
  );

  const STEPS: TempoStep[] = ['network', 'connecting', 'verify', 'success'];
  const stepIndex = STEPS.indexOf(step);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;
  const isSuccess = step === 'success';

  const subtitle =
    step === 'network'
      ? 'Choose a network to continue'
      : step === 'connecting'
        ? 'Opening your wallet…'
        : step === 'verify'
          ? 'One quick signature'
          : 'Welcome back';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[420px] p-0 gap-0 rounded-3xl overflow-hidden border-none shadow-[0_20px_50px_-20px_rgba(45,52,54,0.2)]">
        <DialogTitle className="sr-only">Sign in with Tempo Wallet</DialogTitle>
        <DialogDescription className="sr-only">
          Connect your Tempo wallet to continue
        </DialogDescription>

        {/* Header */}
        <div className="px-6 pt-6 pb-5 bg-[#FDFBF8] border-b border-[#EDE9E3]">
          <div className="pr-10">
            <p className="text-[15px] font-semibold text-[#2D3436] tracking-tight leading-tight">
              Sign in with Tempo
            </p>
            <motion.p
              key={subtitle}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="text-[12px] text-[#9B9590] mt-0.5"
            >
              {subtitle}
            </motion.p>
          </div>

          {/* Progress bar */}
          <div className="relative mt-5 h-[5px] rounded-full bg-[#EDE9E3] overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: isSuccess ? '#6B8F71' : '#E07A5F' }}
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>

        {/* Body */}
        <div className="relative min-h-[280px]">
          <AnimatePresence mode="wait">
            {step === 'network' && (
              <motion.div
                key="network"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="px-6 pt-5 pb-6"
              >
                <div className="space-y-2">
                  {NETWORKS.map(net => (
                    <button
                      key={net.id}
                      onClick={() => handleSelectNetwork(net.id)}
                      disabled={isLoading}
                      className="group w-full flex items-center gap-3.5 p-3.5 rounded-2xl border border-[#EDE9E3] bg-white hover:border-[#E07A5F] hover:bg-[#FDFBF8] transition-all text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${net.color}18` }}
                      >
                        <Globe
                          className="w-[18px] h-[18px]"
                          style={{ color: net.color }}
                          strokeWidth={2}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-semibold text-[#2D3436]">{net.name}</p>
                        <p className="text-[11.5px] text-[#9B9590] mt-0.5">{net.subtitle}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[#B5B0AA] group-hover:text-[#E07A5F] group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  ))}
                </div>

                {error && (
                  <div className="mt-3 px-3 py-2.5 rounded-xl bg-[#E07A5F]/8 border border-[#E07A5F]/20">
                    <p className="text-[12px] text-[#B5614A] text-center">{error}</p>
                  </div>
                )}

                <p className="text-[11.5px] text-center text-[#9B9590] mt-5">
                  Don&apos;t have a wallet?{' '}
                  <a
                    href="https://wallet.tempo.xyz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#9B72CF] hover:text-[#8A62BF] transition-colors"
                  >
                    Create one →
                  </a>
                </p>
              </motion.div>
            )}

            {step === 'connecting' && (
              <motion.div
                key="connecting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="px-6 py-12 flex flex-col items-center text-center"
              >
                <div className="relative w-20 h-20 mb-5">
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{ backgroundColor: '#E07A5F', opacity: 0.12 }}
                    animate={{ scale: [1, 1.2, 1], opacity: [0.18, 0.06, 0.18] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <motion.div
                    className="absolute inset-2 rounded-full"
                    style={{ backgroundColor: '#E07A5F', opacity: 0.2 }}
                    animate={{ scale: [1, 1.12, 1], opacity: [0.25, 0.12, 0.25] }}
                    transition={{
                      duration: 1.8,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: 0.25,
                    }}
                  />
                  <div
                    className="absolute inset-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: '#E07A5F' }}
                  >
                    <Loader2 className="w-5 h-5 text-white animate-spin" strokeWidth={2.5} />
                  </div>
                </div>
                <p className="text-[14px] font-semibold text-[#2D3436]">
                  Connecting to {selectedNetwork === 'mainnet' ? 'Mainnet' : 'Testnet'}
                </p>
                <p className="text-[12px] text-[#9B9590] mt-1.5 max-w-[260px] leading-relaxed">
                  Approve the connection in your Tempo Wallet popup to continue.
                </p>
              </motion.div>
            )}

            {step === 'verify' && (
              <motion.div
                key="verify"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="px-6 pt-5 pb-6"
              >
                <div className="mb-3 px-1">
                  <p className="text-[12.5px] text-[#6B6560] leading-relaxed">
                    Prove you own this wallet by signing a message. This confirms your identity —
                    it&apos;s not a transaction and costs nothing.
                  </p>
                </div>
                <button
                  onClick={handleVerify}
                  disabled={isLoading}
                  className="group w-full flex items-center gap-3.5 p-3.5 rounded-2xl border border-[#EDE9E3] bg-white hover:border-[#6B8F71] hover:bg-[#FDFBF8] transition-all text-left cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:border-[#EDE9E3] disabled:hover:bg-white"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: '#6B8F7118' }}
                  >
                    <PenLine className="w-[18px] h-[18px] text-[#6B8F71]" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold text-[#2D3436]">
                      {isLoading ? 'Waiting for signature…' : 'Sign Message'}
                    </p>
                    <p className="text-[11.5px] text-[#9B9590] mt-0.5">
                      No transaction, no gas — just a signature.
                    </p>
                  </div>
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#6B8F71] shrink-0" />
                  ) : (
                    <ArrowRight className="w-4 h-4 text-[#B5B0AA] group-hover:text-[#6B8F71] group-hover:translate-x-0.5 transition-all shrink-0" />
                  )}
                </button>

                {error && (
                  <div className="mt-3 px-3 py-2.5 rounded-xl bg-[#E07A5F]/8 border border-[#E07A5F]/20">
                    <p className="text-[12px] text-[#B5614A] text-center">{error}</p>
                  </div>
                )}
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="px-6 py-12 flex flex-col items-center text-center"
              >
                <div className="relative w-20 h-20 mb-5">
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{ backgroundColor: '#6B8F71', opacity: 0.15 }}
                    animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0, 0.2] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                  />
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 16 }}
                    className="absolute inset-3 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: '#6B8F71' }}
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        delay: 0.15,
                        type: 'spring',
                        stiffness: 300,
                        damping: 14,
                      }}
                    >
                      <Check className="w-7 h-7 text-white" strokeWidth={3} />
                    </motion.div>
                  </motion.div>
                </div>
                <p className="text-[15px] font-bold text-[#2D3436]">You&apos;re signed in</p>
                <p className="text-[12px] text-[#9B9590] mt-1.5">Redirecting to your dashboard…</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const features = [
  {
    icon: LayoutDashboard,
    label: 'Dashboard',
    desc: 'Portfolio overview & analytics',
    color: '#E07A5F',
  },
  { icon: Send, label: 'Send', desc: 'Transfer tokens instantly', color: '#9B72CF' },
  { icon: ArrowDownUp, label: 'DEX Swap', desc: 'Trade stablecoins instantly', color: '#6B8F71' },
  { icon: ListPlus, label: 'Batch Payments', desc: 'Send to many at once', color: '#E07A5F' },
  {
    icon: Clock,
    label: 'Recurring Payments',
    desc: 'Automated scheduled transfers',
    color: '#9B72CF',
  },
  {
    icon: CircleDollarSign,
    label: 'TIP20 Studio',
    desc: 'Create & manage tokens',
    color: '#6B8F71',
  },
  {
    icon: Shield,
    label: 'TIP403 Factory',
    desc: 'Deploy access-controlled tokens',
    color: '#E07A5F',
  },
  { icon: Key, label: 'Access Keys', desc: 'Manage signing permissions', color: '#9B72CF' },
  { icon: QrCode, label: 'Receive', desc: 'Generate payment QR codes', color: '#6B8F71' },
  { icon: Users, label: 'Contacts', desc: 'Save & organize addresses', color: '#E07A5F' },
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
        color: '#6B8F71',
      },
      {
        icon: ListPlus,
        title: 'Batch Payments',
        desc: 'Send tokens to multiple recipients in a single transaction. Perfect for payroll, airdrops, and batch distributions.',
        color: '#E07A5F',
      },
      {
        icon: RefreshCw,
        title: 'Recurring Payments',
        desc: 'Automated token transfers on a schedule. Set frequency, amount, and let the protocol handle the rest.',
        color: '#E07A5F',
      },
      {
        icon: Clock,
        title: 'Scheduled Payments',
        desc: 'Schedule one-time payments for a future time. Perfect for timed releases, payroll, and planned distributions.',
        color: '#D4A574',
      },
    ],
  },
  {
    label: 'Exchange',
    heading: 'Swap stablecoins instantly',
    subtitle:
      'Trade between any stablecoins on Tempo DEX with intelligent multi-hop routing and best-rate execution.',
    items: [
      {
        icon: ArrowDownUp,
        title: 'DEX Swap',
        desc: 'Exchange any stablecoin pair with automatic route finding. Direct swaps or multi-hop via intermediate tokens for the best rate.',
        color: '#E07A5F',
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
        color: '#E07A5F',
      },
      {
        icon: ShieldCheck,
        title: 'Token Approvals',
        desc: 'View and manage token spending allowances. Grant approvals to spenders or revoke them instantly.',
        color: '#6B8F71',
      },
      {
        icon: Gift,
        title: 'TIP20 Rewards',
        desc: 'Claim accumulated token rewards from opted-in TIP20 tokens. Track claimable balances across all your holdings.',
        color: '#6B8F71',
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
        color: '#6B8F71',
      },
    ],
  },
];

function LandingPage(): ReactElement {
  const navigate = useNavigate();
  const { isConnected, isConnecting, signUp, signIn, connectTempoWallet, signTempoWallet } =
    useTempo();

  const [showTempoConnectModal, setShowTempoConnectModal] = useState(false);
  const [showCreateWallet, setShowCreateWallet] = useState(false);
  const [connectingType, setConnectingType] = useState<string | null>(null);
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [contractExplorerUrl, setContractExplorerUrl] = useState<string | null>(null);
  const [copiedContract, setCopiedContract] = useState(false);

  useEffect(() => {
    if (isConnected) {
      isAccessTokenExpired().then(expired => {
        if (!expired) navigate({ to: '/portal/dashboard' });
      });
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

  const handlePasskeySignIn = async (): Promise<void> => {
    setConnectingType('passkey');
    try {
      await signIn();
    } catch (err) {
      toast.error('Sign in failed', { description: (err as Error).message });
    } finally {
      setConnectingType(null);
    }
  };

  const handleOpenWizard = useCallback(() => {
    setShowTempoConnectModal(true);
  }, []);

  const handleWizardSuccess = useCallback(
    (network: 'testnet' | 'mainnet') => {
      setShowTempoConnectModal(false);
      if (network !== TEMPO_NETWORK) {
        // Switch app network to match what the user connected on
        localStorage.setItem('temporium_network', network);
        window.location.href = '/portal/dashboard';
      } else {
        navigate({ to: '/portal/dashboard' });
      }
    },
    [navigate]
  );

  return (
    <div className="min-h-screen bg-[#FDFBF8] flex flex-col relative ">
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
      <header className="relative z-10 py-5 max-w-5xl mx-auto w-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/logo-dark.png" alt="Temporium" className="w-8 h-8 rounded-full" />
          <span className="text-[17px] font-bold text-[#2D3436] tracking-tight">Temporium</span>
        </div>
        <nav className="flex items-center gap-1">
          {isDevMode && (
            <a
              href="#how-it-works"
              onClick={e => {
                e.preventDefault();
                document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium text-[#6B6560] hover:text-[#2D3436] hover:bg-[#F5F2ED]/80 transition-all"
            >
              <Fingerprint className="w-3.5 h-3.5" strokeWidth={1.75} />
              How it works
            </a>
          )}
          <a
            href="#features"
            onClick={e => {
              e.preventDefault();
              document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium text-[#6B6560] hover:text-[#2D3436] hover:bg-[#F5F2ED]/80 transition-all"
          >
            <LayoutDashboard className="w-3.5 h-3.5" strokeWidth={1.75} />
            Features
          </a>
          <div className="w-px h-4 bg-[#EDE9E3] mx-1" />
          <a
            href="https://x.com/HelloTemporium"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium text-[#6B6560] hover:text-[#2D3436] hover:bg-[#F5F2ED]/80 transition-all"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Twitter
          </a>
        </nav>
      </header>

      {/* Main content — 2-column layout */}
      <main className="relative z-10 flex-1 flex flex-col">
        <div className="max-w-5xl w-full mx-auto flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center px-6 py-12 sm:py-16 lg:py-24">
          {/* ── Left: Hero ── */}
          <section className="flex flex-col justify-center items-center lg:items-start text-center lg:text-left">
            {/* Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08, ease: [0.25, 0.1, 0.25, 1] }}
              className="mb-6"
            >
              <span className="block text-[42px] sm:text-[54px] lg:text-[62px] font-bold text-[#2D3436] leading-[1.05] tracking-[-0.03em]">
                Your{' '}
                <span className="relative inline-block">
                  <span className="relative z-10 text-[#E07A5F]">Gateway</span>
                  <motion.span
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.5, delay: 0.55, ease: [0.25, 0.1, 0.25, 1] }}
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
              transition={{ duration: 0.5, delay: 0.18 }}
              className="text-[16px] sm:text-[17px] text-[#8A8580] leading-relaxed mb-10 max-w-[420px]"
            >
              The all-in-one toolkit for payments, swaps, and token management on Tempo.
            </motion.p>

            {/* Tempo Wallet */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.28 }}
              className="space-y-3"
            >
              <Button
                onClick={handleOpenWizard}
                disabled={!!connectingType}
                className="h-[50px] px-7 rounded-2xl text-[14px] font-semibold bg-[#E07A5F] hover:bg-[#D4694F] text-white shadow-lg shadow-[#E07A5F]/15 hover:shadow-xl hover:shadow-[#E07A5F]/20 transition-all duration-300 hover:-translate-y-0.5"
              >
                <Globe className="w-4 h-4 mr-2" />
                Connect Tempo Wallet
              </Button>

              {/* Passkey Wallet (dev mode) */}
              {isDevMode && (
                <div className="pt-4 border-t border-[#EDE9E3]/60">
                  <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-wider mb-3">
                    Passkey Wallet (Dev)
                  </p>
                  <div className="flex items-center gap-2.5">
                    <Button
                      onClick={handlePasskeySignIn}
                      disabled={!!connectingType}
                      variant="outline"
                      className="h-[42px] px-5 rounded-xl text-[13px] font-semibold border-[#E2DDD6] bg-white hover:bg-[#FDFBF8] text-[#2D3436]"
                    >
                      {connectingType === 'passkey' ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Fingerprint className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      {connectingType === 'passkey' ? 'Signing in...' : 'Sign In'}
                    </Button>
                    <Button
                      onClick={() => setShowCreateWallet(true)}
                      disabled={!!connectingType}
                      variant="outline"
                      className="h-[42px] px-5 rounded-xl text-[13px] font-semibold border-[#E2DDD6] bg-white hover:bg-[#FDFBF8] text-[#2D3436]"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      Create
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Loading state */}
            <AnimatePresence>
              {connectingType && connectingType !== 'passkey' && (
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

            {/* Passkey hint */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="mt-8 flex items-center gap-2 text-[12px] text-[#B5B0AA]"
            >
              <Fingerprint className="w-3.5 h-3.5 text-[#E07A5F]/60" />
              <span>Secured by passkeys, no seed phrases</span>
            </motion.div>
          </section>

          {/* ── Right: Feature showcase ── */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.05, delayChildren: 0.3 },
              },
            }}
            className="hidden lg:flex flex-col gap-3"
          >
            {/* Top row — 3 highlight cards */}
            <div className="grid grid-cols-3 gap-3">
              {features.slice(0, 3).map(f => (
                <motion.div
                  key={f.label}
                  variants={{
                    hidden: { opacity: 0, y: 18, scale: 0.97 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const },
                    },
                  }}
                  whileHover={{ y: -4, transition: { duration: 0.25, ease: 'easeOut' } }}
                  className="group relative rounded-2xl bg-white border border-[#EDE9E3]/80 p-5 cursor-default overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-black/[0.06] hover:border-[#D5D0C9]"
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-[2px] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-400 ease-out"
                    style={{ backgroundColor: f.color }}
                  />
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110"
                    style={{ backgroundColor: `${f.color}12` }}
                  >
                    <f.icon
                      className="w-[18px] h-[18px]"
                      style={{ color: f.color }}
                      strokeWidth={1.7}
                    />
                  </div>
                  <p className="text-[13px] font-semibold text-[#2D3436] leading-tight">
                    {f.label}
                  </p>
                  <p className="text-[11px] text-[#9B9590] leading-snug mt-1">{f.desc}</p>
                </motion.div>
              ))}
            </div>

            {/* Middle row — 2 wide feature cards */}
            <div className="grid grid-cols-2 gap-3">
              {features.slice(3, 5).map(f => (
                <motion.div
                  key={f.label}
                  variants={{
                    hidden: { opacity: 0, y: 18, scale: 0.97 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const },
                    },
                  }}
                  whileHover={{ y: -4, transition: { duration: 0.25, ease: 'easeOut' } }}
                  className="group relative rounded-2xl bg-white border border-[#EDE9E3]/80 p-5 cursor-default overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-black/[0.06] hover:border-[#D5D0C9]"
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-[2px] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-400 ease-out"
                    style={{ backgroundColor: f.color }}
                  />
                  <div className="flex items-start gap-3.5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110"
                      style={{ backgroundColor: `${f.color}12` }}
                    >
                      <f.icon
                        className="w-[18px] h-[18px]"
                        style={{ color: f.color }}
                        strokeWidth={1.7}
                      />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-[13px] font-semibold text-[#2D3436] leading-tight">
                        {f.label}
                      </p>
                      <p className="text-[11px] text-[#9B9590] leading-snug mt-1">{f.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Third row — 2 wide cards */}
            <div className="grid grid-cols-2 gap-3">
              {features.slice(5, 7).map(f => (
                <motion.div
                  key={f.label}
                  variants={{
                    hidden: { opacity: 0, y: 18, scale: 0.97 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const },
                    },
                  }}
                  whileHover={{ y: -4, transition: { duration: 0.25, ease: 'easeOut' } }}
                  className="group relative rounded-2xl bg-white border border-[#EDE9E3]/80 p-5 cursor-default overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-black/[0.06] hover:border-[#D5D0C9]"
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-[2px] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-400 ease-out"
                    style={{ backgroundColor: f.color }}
                  />
                  <div className="flex items-start gap-3.5">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110"
                      style={{ backgroundColor: `${f.color}12` }}
                    >
                      <f.icon
                        className="w-[18px] h-[18px]"
                        style={{ color: f.color }}
                        strokeWidth={1.7}
                      />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-[13px] font-semibold text-[#2D3436] leading-tight">
                        {f.label}
                      </p>
                      <p className="text-[11px] text-[#9B9590] leading-snug mt-1">{f.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Bottom row — remaining features in a single card */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 14 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
                },
              }}
              className="rounded-2xl bg-white border border-[#EDE9E3]/80 p-4 cursor-default"
            >
              <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                {features.slice(7).map(f => (
                  <div key={f.label} className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${f.color}12` }}
                    >
                      <f.icon
                        className="w-3.5 h-3.5"
                        style={{ color: f.color }}
                        strokeWidth={1.7}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-[#4D5456] leading-tight">
                      {f.label}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Built for Tempo badge */}
            <motion.div
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { duration: 0.5, delay: 0.2 } },
              }}
              className="flex items-center justify-center gap-2 pt-1"
            >
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#EDE9E3] to-transparent" />
              <span className="text-[10px] font-semibold text-[#C5C0BA] uppercase tracking-[0.14em] px-3">
                Built for Tempo
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#EDE9E3] to-transparent" />
            </motion.div>
          </motion.div>
        </div>
      </main>

      {/* How It Works (dev only) */}
      {isDevMode && (
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
                  color: '#E07A5F',
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
                  color: '#6B8F71',
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
                    <step.icon
                      className="w-5 h-5"
                      style={{ color: step.color }}
                      strokeWidth={1.7}
                    />
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
                  <div className="w-9 h-9 rounded-xl bg-[#E07A5F]/8 flex items-center justify-center shrink-0">
                    <Database className="w-4 h-4 text-[#E07A5F]" strokeWidth={1.7} />
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
                      <Check className="w-3.5 h-3.5 text-[#6B8F71]" />
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
      )}

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

      {/* Connect Wizard */}
      <TempoConnectModal
        isOpen={showTempoConnectModal}
        onClose={() => setShowTempoConnectModal(false)}
        connectTempoWallet={connectTempoWallet}
        signTempoWallet={signTempoWallet}
        onSuccess={handleWizardSuccess}
      />

      {/* Dev mode: Create Wallet Modal (passkey) */}
      {isDevMode && (
        <CreateWalletModal
          isOpen={showCreateWallet}
          isLoading={isConnecting}
          onClose={() => setShowCreateWallet(false)}
          onCreateWallet={handleCreateWallet}
          onSignIn={() => {
            setShowCreateWallet(false);
            setShowTempoConnectModal(true);
          }}
        />
      )}
    </div>
  );
}
