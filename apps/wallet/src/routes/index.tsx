import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, type ReactElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Fingerprint,
  Wallet,
  ArrowRight,
  Zap,
  Clock,
  Shield,
  X,
  Check,
  Smartphone,
  Send,
  ArrowLeftRight,
  Droplets,
  Coins,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTempo } from '@/hooks/useTempo';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage(): ReactElement {
  const { isConnected, isConnecting, signUp, signIn } = useTempo();
  const navigate = useNavigate();
  const [showPasskeyModal, setShowPasskeyModal] = useState(false);
  const [walletName, setWalletName] = useState('');

  useEffect(() => {
    if (isConnected) {
      navigate({ to: '/portal/dashboard' });
    }
  }, [isConnected, navigate]);

  const features = [
    {
      icon: Shield,
      title: 'Passkey Security',
      description: 'Face ID, Touch ID, or PIN',
      color: '#10b981',
    },
    {
      icon: Send,
      title: 'Send & Receive',
      description: 'Instant transfers',
      color: '#635bff',
    },
    {
      icon: ArrowLeftRight,
      title: 'Token Swap',
      description: 'Exchange tokens easily',
      color: '#f59e0b',
    },
    {
      icon: Droplets,
      title: 'Liquidity Pools',
      description: 'Provide liquidity & earn',
      color: '#06b6d4',
    },
    {
      icon: Coins,
      title: 'Stablecoins',
      description: 'Mint & manage USD',
      color: '#f97316',
    },
    {
      icon: Users,
      title: 'Contacts',
      description: 'Save frequent addresses',
      color: '#64748b',
    },
    {
      icon: Clock,
      title: 'Scheduled Payments',
      description: 'Sign once, execute later',
      color: '#8b5cf6',
    },
    {
      icon: Zap,
      title: 'Sub-cent Fees',
      description: 'Transactions under $0.001',
      color: '#3b82f6',
    },
  ];

  const openModal = (): void => {
    setWalletName('');
    setShowPasskeyModal(true);
  };

  const closeModal = (): void => {
    setWalletName('');
    setShowPasskeyModal(false);
  };

  const handleCreateWallet = async (): Promise<void> => {
    try {
      await signUp(walletName.trim() || undefined);
    } catch {
      toast.error('Wallet creation cancelled');
    }
  };

  return (
    <>
      <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
        {/* Animated background */}
        <div className="fixed inset-0 -z-10 overflow-hidden">
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl"
          />
          <motion.div
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#0073e6]/20 rounded-full blur-3xl"
          />
        </div>

        {/* Content */}
        <div className="max-w-2xl w-full text-center">
          {/* Badge */}
          <motion.div
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
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
            transition={{ delay: 0.05 }}
            className="text-4xl sm:text-5xl font-bold tracking-tight mb-4"
          >
            The <span className="text-primary">Passkey Wallet</span>
            <br />
            for Tempo Blockchain
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-[16px] text-muted-foreground mb-8 max-w-lg mx-auto"
          >
            Send, receive, and schedule payments with sub-cent fees. No seed phrases. No browser
            extensions. Just passkeys.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="flex flex-wrap justify-center gap-3 mb-12"
          >
            <Button size="lg" onClick={openModal} isLoading={isConnecting} className="group px-6">
              <Wallet className="h-4 w-4" />
              Create Wallet
              <ArrowRight className="h-4 w-4 ml-1 opacity-60 group-hover:translate-x-0.5 transition-transform" />
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={() => signIn()}
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
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
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

          {/* Tempo branding */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-10 flex items-center justify-center gap-2 text-muted-foreground"
          >
            <span className="text-[12px]">Powered by</span>
            <a
              href="https://tempo.xyz/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] font-semibold text-foreground hover:text-primary transition-colors"
            >
              Tempo
            </a>
          </motion.div>
        </div>
      </main>

      {/* Passkey Explanation Modal */}
      <AnimatePresence>
        {showPasskeyModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={closeModal}
              className="fixed inset-0 bg-black/50 z-50"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.15 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[360px] z-50 px-4"
            >
              <div className="bg-white rounded-xl shadow-xl overflow-hidden">
                {/* Header */}
                <div className="relative px-5 pt-5 pb-4">
                  <button
                    onClick={closeModal}
                    className="absolute right-4 top-4 p-1 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    <X className="h-4 w-4 text-gray-400" />
                  </button>

                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                    <Fingerprint className="h-5 w-5 text-primary" />
                  </div>

                  <h2 className="text-[15px] font-semibold text-gray-900">What is a Passkey?</h2>
                  <p className="text-[12px] text-gray-500 mt-0.5">
                    A modern replacement for passwords
                  </p>
                </div>

                {/* Content */}
                <div className="px-5 pb-4">
                  {/* Wallet Name Input */}
                  <div className="mb-4">
                    <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">
                      Wallet Name
                    </label>
                    <Input
                      placeholder="e.g., Personal, Business, Savings..."
                      value={walletName}
                      onChange={e => setWalletName(e.target.value)}
                      className="text-[13px] h-10"
                      maxLength={30}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                      Saved as:{' '}
                      <span className="font-medium text-gray-600">
                        Tollr: {walletName || 'Wallet'}
                      </span>
                    </p>
                  </div>

                  {/* How it works */}
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 mb-3">
                    <Smartphone className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-gray-600 leading-relaxed">
                      Your device creates a cryptographic key protected by Face ID, Touch ID, or
                      PIN. The private key never leaves your device.
                    </p>
                  </div>

                  {/* Benefits */}
                  <div className="space-y-1.5">
                    {[
                      'No passwords to remember',
                      'Protected by biometrics',
                      'Cannot be phished',
                      'Works across devices',
                    ].map(benefit => (
                      <div key={benefit} className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                        <span className="text-[12px] text-gray-700">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-5 pb-5 pt-2">
                  <Button
                    className="w-full h-10"
                    onClick={handleCreateWallet}
                    isLoading={isConnecting}
                  >
                    <Fingerprint className="h-4 w-4" />
                    Create Passkey Wallet
                  </Button>
                  <p className="text-[10px] text-gray-400 text-center mt-2">
                    You&apos;ll authenticate with your device
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
