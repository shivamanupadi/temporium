import { type ReactElement, useState, useEffect, useCallback } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, Fingerprint, ArrowRight, Plus, Loader2, Database, Shield, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CreateWalletModal } from '@temporium/shared-ui';
import { WalletSelectModal } from '@/components/WalletSelectModal';
import { useTempo } from '@/hooks/useTempo';
import { getWalletApiUrl } from '@/lib/api';
import { copyToClipboard } from '@/lib/utils';

export const Route = createFileRoute('/')({
  component: AuthPage,
});

function AuthPage(): ReactElement | null {
  const { isConnected, isConnecting, signUp, signIn } = useTempo();
  const navigate = useNavigate();

  const [showCreateWalletModal, setShowCreateWalletModal] = useState(false);
  const [showWalletSelectModal, setShowWalletSelectModal] = useState(false);
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [contractExplorerUrl, setContractExplorerUrl] = useState<string | null>(null);
  const [copiedContract, setCopiedContract] = useState(false);

  // Redirect to wallet if already connected
  useEffect(() => {
    if (isConnected) {
      navigate({ to: '/wallet' });
    }
  }, [isConnected, navigate]);

  useEffect(() => {
    fetch(`${getWalletApiUrl()}/contracts`)
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
    <div className="min-h-screen bg-[#FDFBF8] flex flex-col relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 60% 50% at 85% 15%, rgba(224,122,95,0.06) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 10% 85%, rgba(155,114,207,0.05) 0%, transparent 70%), radial-gradient(ellipse 40% 40% at 50% 50%, rgba(91,154,111,0.03) 0%, transparent 60%)',
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-5 flex items-center justify-between max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Temporium" className="w-8 h-8 rounded-lg" />
          <span className="text-[17px] font-bold text-[#2D3436] tracking-tight">Temporium</span>
          <span className="text-[17px] font-medium text-[#B5B0AA] tracking-tight">| Wallet</span>
        </div>
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
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-sm w-full text-center">
          {/* Passkey badge */}
          <motion.a
            href="https://docs.tempo.xyz/guide/use-accounts/embed-passkeys#embed-passkey-accounts"
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-[#EDE9E3] bg-white mb-8 shadow-xs hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="w-[22px] h-[22px] rounded-full bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
              <Fingerprint className="h-3 w-3 text-primary" />
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
            <span className="block text-[40px] sm:text-[48px] font-bold text-[#2D3436] leading-[1.05] tracking-[-0.03em]">
              Temporium{' '}
              <span className="relative inline-block">
                <span className="relative z-10 text-primary">Wallet</span>
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.5, delay: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
                  className="absolute -bottom-1 left-0 right-0 h-[3px] bg-gradient-to-r from-primary/60 via-primary/40 to-transparent rounded-full origin-left"
                />
              </span>
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.22 }}
            className="text-[15px] sm:text-[16px] text-[#8A8580] leading-relaxed mb-10 max-w-sm mx-auto"
          >
            Connect your wallet to any Tempo app.
            <br />
            Your passkey works across all Temporium services.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.32 }}
            className="flex items-center justify-center gap-3.5"
          >
            <Button
              onClick={() => setShowCreateWalletModal(true)}
              disabled={isConnecting}
              className="h-[50px] px-7 rounded-2xl text-[14px] font-semibold bg-primary hover:bg-primary/85 text-white shadow-lg shadow-primary/15 hover:shadow-xl hover:shadow-primary/20 transition-all duration-300 hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Wallet
            </Button>

            <Button
              onClick={() => setShowWalletSelectModal(true)}
              disabled={isConnecting}
              variant="outline"
              className="h-[50px] px-7 rounded-2xl text-[14px] font-semibold border-[#E2DDD6] bg-white hover:bg-[#FDFBF8] hover:border-[#D5D0C9] text-[#2D3436] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/[0.04]"
            >
              Sign In
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>

          {/* Loading state */}
          <AnimatePresence>
            {isConnecting && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-6 flex items-center justify-center gap-2.5 text-[13px] text-[#9B9590]"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting...
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* How It Works */}
      <section className="relative z-10 border-t border-[#EDE9E3]/60 py-14 px-6">
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: Fingerprint,
                title: 'Passkey Auth',
                desc: 'Sign in with Face ID, Touch ID, or your device PIN. No passwords or seed phrases to remember.',
                color: 'var(--primary)',
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
                <span className="text-[11px] font-bold text-[#E2DDD6] tracking-wider">{step.step}</span>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mt-3 mb-3"
                  style={{ backgroundColor: `color-mix(in srgb, ${step.color} 8%, transparent)` }}
                >
                  <step.icon className="w-5 h-5" style={{ color: step.color }} strokeWidth={1.7} />
                </div>
                <h3 className="text-[14px] font-semibold text-[#2D3436] mb-1">{step.title}</h3>
                <p className="text-[13px] text-[#8A8580] leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>

          {contractAddress && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="mt-6 rounded-2xl border border-[#EDE9E3]/80 bg-white p-5 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                  <Database className="w-4 h-4 text-primary" strokeWidth={1.7} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[#B5B0AA] uppercase tracking-wider">Passkey Registry Contract</p>
                  <p className="text-[13px] font-mono text-[#6B6560] truncate mt-0.5">{contractAddress}</p>
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

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#EDE9E3]/60 py-6 text-center">
        <p className="text-[11.5px] text-[#B5B0AA]">
          Powered by{' '}
          <a
            href="https://tempo.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/85 transition-colors"
          >
            Tempo
          </a>
        </p>
      </footer>

      {/* Create Wallet Modal */}
      <CreateWalletModal
        isOpen={showCreateWalletModal}
        isLoading={isConnecting}
        onClose={() => setShowCreateWalletModal(false)}
        onCreateWallet={handleCreateWallet}
        accentColor="var(--primary)"
      />

      {/* Wallet Select Modal (Sign In) */}
      <WalletSelectModal
        isOpen={showWalletSelectModal}
        isLoading={isConnecting}
        onClose={() => setShowWalletSelectModal(false)}
        onSelectPasskey={handlePasskeySignIn}
        onCreateWallet={() => setShowCreateWalletModal(true)}
      />
    </div>
  );
}
