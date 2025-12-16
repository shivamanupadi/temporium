import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, type ReactElement } from 'react';
import { motion } from 'framer-motion';
import {
  Fingerprint,
  Wallet,
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
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CreateWalletModal } from '@/components/CreateWalletModal';
import { WalletSelectModal } from '@/components/WalletSelectModal';
import { useTempo } from '@/hooks/useTempo';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage(): ReactElement {
  const { isConnected, isConnecting, signUp, signIn, connectInjected, hasInjectedWallet } =
    useTempo();
  const navigate = useNavigate();
  const [showCreateWalletModal, setShowCreateWalletModal] = useState(false);
  const [showWalletSelectModal, setShowWalletSelectModal] = useState(false);

  useEffect(() => {
    // Wait for full auth flow to complete (including SIWE for external wallets)
    if (isConnected && !isConnecting) {
      navigate({ to: '/portal/dashboard' });
    }
  }, [isConnected, isConnecting, navigate]);

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
      icon: Shield,
      title: 'TIP403 Factory',
      description: 'Access control policies',
      color: '#8b5cf6',
    },
    {
      icon: Clock,
      title: 'Scheduled',
      description: 'Sign once, execute later',
      color: '#ec4899',
    },
    {
      icon: Users,
      title: 'Contacts',
      description: 'Save frequent addresses',
      color: '#a78bfa',
    },
    {
      icon: Key,
      title: 'Access Keys',
      description: 'Manage session keys',
      color: '#eab308',
    },
  ];

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
      <div className="fixed top-0 left-0 right-0 z-50 px-6 py-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex items-center gap-2.5"
          >
            <Zap className="w-6 h-6 text-slate-900" strokeWidth={2} />
            <span className="text-lg font-bold text-slate-900 tracking-tight">Temporium</span>
          </motion.div>
          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex items-center gap-4"
          >
            <a
              href="https://x.com/HelloTemporium"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-primary transition-colors"
            >
              <Twitter className="h-4 w-4" />
            </a>
            <a
              href="mailto:hello@temporium.xyz"
              className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-primary transition-colors"
            >
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">hello@temporium.xyz</span>
            </a>
          </motion.div>
        </div>
      </div>

      <main className="min-h-screen flex flex-col items-center justify-center px-6 pt-28 pb-12">
        {/* Static background gradient - no animations for performance */}
        <div className="fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#0073e6]/15 rounded-full blur-3xl" />
        </div>

        {/* Content */}
        <div className="max-w-4xl w-full text-center">
          {/* Badge */}
          <motion.div
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white backdrop-blur border border-border shadow-sm mb-6"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-[13px] font-medium text-foreground">
              Built for Tempo Blockchain
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl font-bold tracking-tight mb-4"
          >
            Your <span className="text-primary">Gateway</span> to
            <br />
            Tempo Blockchain
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-[16px] text-muted-foreground mb-8 max-w-lg mx-auto"
          >
            Send, receive, swap, provide liquidity, create tokens, schedule payments, and manage
            access. All with sub-cent fees.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap justify-center gap-3 mb-12"
          >
            <Button
              size="lg"
              onClick={() => setShowCreateWalletModal(true)}
              isLoading={isConnecting}
              className="group px-6"
            >
              <Wallet className="h-4 w-4" />
              Create Wallet
              <ArrowRight className="h-4 w-4 ml-1 opacity-60 group-hover:translate-x-0.5 transition-transform" />
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={() => setShowWalletSelectModal(true)}
              disabled={isConnecting}
              className="px-6 bg-white backdrop-blur"
            >
              <Fingerprint className="h-4 w-4" />
              Sign In
            </Button>
          </motion.div>

          {/* Features Grid */}
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="grid grid-cols-2 sm:grid-cols-5 gap-2.5"
          >
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.25 + index * 0.05 }}
                whileHover={{ y: -2, transition: { duration: 0.2 } }}
                className="group relative bg-white backdrop-blur rounded-xl border border-border p-4 cursor-default"
              >
                {/* Hover glow */}
                <div
                  className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"
                  style={{
                    background: `radial-gradient(circle at center, ${feature.color}15 0%, transparent 70%)`,
                  }}
                />

                {/* Icon */}
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2"
                  style={{ backgroundColor: `${feature.color}15` }}
                >
                  <feature.icon className="h-5 w-5" style={{ color: feature.color }} />
                </motion.div>

                <h3 className="text-[13px] font-semibold mb-0.5">{feature.title}</h3>
                <p className="text-[11px] text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Tempo branding & Contact */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-10 flex flex-col items-center gap-3"
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="text-[12px]">Powered by</span>
              <a
                href="https://tempo.xyz/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] font-semibold text-foreground hover:text-primary transition-colors"
              >
                Tempo
              </a>
            </div>
            <a
              href="mailto:hello@temporium.xyz"
              className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-primary transition-colors"
            >
              <Mail className="h-3.5 w-3.5" />
              hello@temporium.xyz
            </a>
          </motion.div>
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
    </>
  );
}
