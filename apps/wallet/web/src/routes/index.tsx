import { type ReactElement, useState, useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { ExternalLink, Fingerprint, ArrowRight, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CreateWalletModal } from '@/components/CreateWalletModal';
import { WalletSelectModal } from '@/components/WalletSelectModal';
import { useTempo } from '@/hooks/useTempo';
import { LINKS } from '@/lib/constants';

export const Route = createFileRoute('/')({
  component: AuthPage,
});

function AuthPage(): ReactElement | null {
  const { isConnected, isConnecting, signUp, signIn } = useTempo();
  const navigate = useNavigate();

  const [showCreateWalletModal, setShowCreateWalletModal] = useState(false);
  const [showWalletSelectModal, setShowWalletSelectModal] = useState(false);

  // Redirect to wallet if already connected
  useEffect(() => {
    if (isConnected) {
      navigate({ to: '/wallet' });
    }
  }, [isConnected, navigate]);

  const handleCreateWallet = async (walletName?: string): Promise<void> => {
    try {
      await signUp(walletName);
      setShowCreateWalletModal(false);
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

  // Don't render auth page if connected (will redirect)
  if (isConnected) {
    return null;
  }

  return (
    <>
      <main className="min-h-screen flex flex-col justify-center px-4 sm:px-6 py-12">
        {/* Background */}
        <div className="fixed inset-0 -z-10 bg-white" />

        <div className="max-w-sm mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <img src="/logo.png" alt="Temporium Wallet" className="w-20 h-20 rounded-xl" />
            </div>

            {/* Heading */}
            <h1 className="text-3xl font-bold tracking-tight mb-3 text-slate-900">
              Temporium Wallet
            </h1>

            {/* Passkey Badge */}
            <div className="inline-flex items-center gap-2 text-[13px] text-slate-600 mb-4">
              <div className="flex items-center justify-center w-5 h-5 rounded-md bg-primary/10">
                <Fingerprint className="h-3 w-3 text-primary" />
              </div>
              <span>Secured by passkeys</span>
            </div>

            {/* Subtitle */}
            <p className="text-[15px] text-slate-500 mb-8 leading-relaxed">
              Connect your wallet to any Tempo app.
              <br />
              Your passkey works across all Temporium services.
            </p>

            {/* CTAs */}
            <div className="flex flex-col gap-3">
              <Button
                size="lg"
                onClick={() => setShowCreateWalletModal(true)}
                isLoading={isConnecting}
                className="group w-full h-12 text-[15px] font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
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
                className="group w-full h-12 text-[15px] font-semibold bg-white/80 backdrop-blur-sm border-slate-200 hover:border-slate-300 hover:bg-white transition-all duration-300"
              >
                <Fingerprint className="h-4 w-4 mr-2 text-slate-500 group-hover:text-primary transition-colors" />
                Sign In
              </Button>
            </div>

            {/* Learn More */}
            <div className="mt-8 pt-6 border-t border-slate-200/50">
              <a
                href={LINKS.docs}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 transition-colors"
              >
                Learn about passkey wallets
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
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
        onClose={() => setShowWalletSelectModal(false)}
        onSelectPasskey={handlePasskeySignIn}
        onCreateWallet={() => setShowCreateWalletModal(true)}
      />
    </>
  );
}
