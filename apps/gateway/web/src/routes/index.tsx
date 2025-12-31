import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, type ReactElement } from 'react';
import { motion } from 'framer-motion';
import {
  Fingerprint,
  ArrowRight,
  Clock,
  Shield,
  Send,
  ArrowLeftRight,
  Droplets,
  Coins,
  Users,
  Download,
  Key,
  LayoutDashboard,
  Zap,
  Mail,
  Twitter,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CreateWalletModal } from '@/components/CreateWalletModal';
import { WalletSelectModal } from '@/components/WalletSelectModal';
import { HowItWorksModal } from '@/components/HowItWorksModal';
import { useTempo } from '@/hooks/useTempo';

export const Route = createFileRoute('/')({
  component: HomePage,
});

// Features list
const features = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    description: 'Overview of your wallet',
    color: '#7c5cff',
  },
  {
    icon: Send,
    title: 'Send',
    description: 'Transfer tokens instantly',
    color: '#10b981',
  },
  {
    icon: Download,
    title: 'Receive',
    description: 'Get your wallet address',
    color: '#06b6d4',
  },
  {
    icon: ArrowLeftRight,
    title: 'Swap',
    description: 'Exchange tokens easily',
    color: '#f59e0b',
  },
  {
    icon: Droplets,
    title: 'Liquidity',
    description: 'Provide liquidity & earn',
    color: '#0ea5e9',
  },
  {
    icon: Coins,
    title: 'TIP20 Studio',
    description: 'Create & manage tokens',
    color: '#f97316',
  },
  {
    icon: Clock,
    title: 'Scheduled',
    description: 'Automate transactions',
    color: '#ec4899',
  },
  {
    icon: Shield,
    title: 'TIP403 Factory',
    description: 'Access control policies',
    color: '#8b5cf6',
  },
  {
    icon: Key,
    title: 'Access Keys',
    description: 'Manage session keys',
    color: '#eab308',
  },
  {
    icon: Users,
    title: 'Contacts',
    description: 'Save frequent addresses',
    color: '#a78bfa',
  },
];

function HomePage(): ReactElement {
  const { isConnected, isConnecting, signUp, signIn, connectInjected, hasInjectedWallet } =
    useTempo();
  const navigate = useNavigate();
  const [showCreateWalletModal, setShowCreateWalletModal] = useState(false);
  const [showWalletSelectModal, setShowWalletSelectModal] = useState(false);
  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);

  useEffect(() => {
    // Wait for full auth flow to complete (including SIWE for external wallets)
    if (isConnected && !isConnecting) {
      navigate({ to: '/portal/dashboard' });
    }
  }, [isConnected, isConnecting, navigate]);

  const handleCreateWallet = async (walletName?: string): Promise<void> => {
    try {
      await signUp(walletName);
    } catch (err) {
      console.error('Wallet creation error:', err);
      toast.error(err instanceof Error ? err.message : 'Wallet creation cancelled');
    }
  };

  const handlePasskeySignIn = async (): Promise<void> => {
    setShowWalletSelectModal(false);
    try {
      await signIn();
    } catch (err) {
      console.error('Sign in error:', err);
      const message = err instanceof Error ? err.message : 'Sign in failed';
      if (message.includes('publicKey not found')) {
        toast.error('Passkey not found. Please create a wallet first.');
      } else {
        toast.error(message);
      }
    }
  };

  const handleInjectedConnect = async (): Promise<void> => {
    setShowWalletSelectModal(false);
    try {
      await connectInjected();
    } catch (err) {
      console.error('Wallet connection error:', err);
      const message = err instanceof Error ? err.message : 'Connection failed';

      // Handle specific errors
      if (message.includes('User rejected') || message.includes('rejected')) {
        toast.error('Connection cancelled');
      } else if (message.includes('Chain not configured')) {
        toast.error('Please add Tempo network to your wallet');
      } else if (message.includes('Failed to verify signature')) {
        toast.error('Sign-in cancelled');
      } else {
        toast.error(message);
      }
    }
  };

  return (
    <>
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 py-4 sm:py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex items-center gap-2.5"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full" />
              <Zap className="relative w-5 h-5 sm:w-6 sm:h-6 text-primary" strokeWidth={2.5} />
            </div>
            <span className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Temporium
              <span className="text-slate-400 font-normal hidden sm:inline"> | Gateway</span>
            </span>
          </motion.div>
          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex items-center gap-0.5 sm:gap-1"
          >
            <button
              onClick={() => setShowHowItWorksModal(true)}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">How it works</span>
            </button>
            <a
              href="mailto:hello@temporium.xyz"
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
            >
              <Mail className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Contact</span>
            </a>
            <a
              href="https://x.com/HelloTemporium"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-8 h-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
            >
              <Twitter className="h-4 w-4" />
            </a>
          </motion.div>
        </div>
      </div>

      <main className="min-h-screen flex flex-col justify-center px-4 sm:px-6 pt-20 pb-12">
        {/* Refined background with mesh gradient effect */}
        <div className="fixed inset-0 -z-10 overflow-hidden">
          {/* Base gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50/80" />
          {/* Ambient orbs */}
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[120px] -translate-y-1/2" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-500/6 rounded-full blur-[100px] translate-y-1/3" />
          <div className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[80px] translate-x-1/2" />
          {/* Subtle grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: `linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)`,
              backgroundSize: '64px 64px',
            }}
          />
        </div>

        {/* 2-Column Layout */}
        <div className="max-w-6xl mx-auto w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Column - Hero Content */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* Heading */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-[-0.03em] mb-5 sm:mb-6 leading-[1.1]">
                <span className="text-slate-900">Your </span>
                <span className="relative">
                  <span className="relative z-10 text-primary">Gateway</span>
                  <span className="absolute -inset-1 bg-primary/10 blur-2xl rounded-full" />
                </span>
                <span className="text-slate-900"> to</span>
                <br />
                <span className="text-slate-900">Tempo Blockchain</span>
              </h1>

              {/* Passkey Badge */}
              <div className="inline-flex items-center gap-2.5 text-[13px] sm:text-[15px] text-slate-600 mb-5">
                <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10">
                  <Fingerprint className="h-3.5 w-3.5 text-primary" />
                </div>
                <span>
                  Powered by{' '}
                  <span className="font-semibold text-slate-800">decentralized passkey wallet</span>
                </span>
              </div>

              {/* Subtitle */}
              <p className="text-[15px] sm:text-[17px] text-slate-500 mb-8 leading-relaxed max-w-lg">
                Send, receive, swap, provide liquidity, create tokens, schedule payments, and manage
                access keys. All with{' '}
                <span className="text-slate-700 font-medium">sub-cent fees</span>.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Button
                  size="lg"
                  onClick={() => setShowCreateWalletModal(true)}
                  isLoading={isConnecting}
                  className="group relative px-7 py-6 text-[15px] font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
                >
                  <Sparkles className="h-4 w-4 mr-2 opacity-80" />
                  Create Wallet
                  <ArrowRight className="h-4 w-4 ml-2 opacity-60 group-hover:translate-x-1 transition-transform duration-300" />
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setShowWalletSelectModal(true)}
                  disabled={isConnecting}
                  className="group px-7 py-6 text-[15px] font-semibold bg-white/80 backdrop-blur-sm border-slate-200 hover:border-slate-300 hover:bg-white transition-all duration-300"
                >
                  <Fingerprint className="h-4 w-4 mr-2 text-slate-500 group-hover:text-primary transition-colors" />
                  Sign In
                </Button>
              </div>

              {/* Powered by */}
              <div className="mt-10 flex items-center gap-3 text-slate-400">
                <span className="text-[12px] sm:text-[13px]">Powered by</span>
                <a
                  href="https://tempo.xyz/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] sm:text-[13px] font-bold text-slate-600 hover:text-primary transition-colors duration-300"
                >
                  Tempo
                </a>
              </div>
            </motion.div>

            {/* Right Column - Features Grid */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="grid grid-cols-2 gap-3">
                {features.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 + index * 0.05 }}
                    whileHover={{
                      y: -3,
                      transition: { duration: 0.2 },
                    }}
                    className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 cursor-default hover:border-slate-300 hover:shadow-md transition-all duration-300"
                  >
                    {/* Hover gradient overlay */}
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400"
                      style={{
                        background: `radial-gradient(ellipse at 50% 0%, ${feature.color}08 0%, transparent 70%)`,
                      }}
                    />

                    {/* Top accent line */}
                    <div
                      className="absolute top-0 left-0 right-0 h-[2px] scale-x-0 group-hover:scale-x-100 transition-transform duration-400 origin-left"
                      style={{ background: feature.color }}
                    />

                    {/* Content */}
                    <div className="relative flex items-start gap-3">
                      {/* Icon */}
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105"
                        style={{ backgroundColor: `${feature.color}12` }}
                      >
                        <feature.icon
                          className="h-4.5 w-4.5"
                          style={{ color: feature.color }}
                          strokeWidth={1.75}
                        />
                      </div>

                      {/* Text */}
                      <div className="min-w-0">
                        <h3 className="text-[13px] sm:text-[14px] font-semibold text-slate-900 mb-0.5 truncate">
                          {feature.title}
                        </h3>
                        <p className="text-[11px] sm:text-[12px] text-slate-500 leading-snug">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Create Wallet Modal */}
      <CreateWalletModal
        isOpen={showCreateWalletModal}
        isLoading={isConnecting}
        onClose={() => setShowCreateWalletModal(false)}
        onCreateWallet={handleCreateWallet}
      />

      {/* Wallet Select Modal (Sign In) */}
      <WalletSelectModal
        isOpen={showWalletSelectModal}
        isLoading={isConnecting}
        hasInjectedWallet={hasInjectedWallet}
        onClose={() => setShowWalletSelectModal(false)}
        onSelectPasskey={handlePasskeySignIn}
        onSelectInjected={handleInjectedConnect}
      />

      {/* How It Works Modal */}
      <HowItWorksModal isOpen={showHowItWorksModal} onClose={() => setShowHowItWorksModal(false)} />
    </>
  );
}
