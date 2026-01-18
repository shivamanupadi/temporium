import { type ReactElement, useState, useEffect } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useBalance } from 'wagmi';
import { motion } from 'framer-motion';
import {
  Wallet,
  Copy,
  Check,
  LogOut,
  ExternalLink,
  QrCode,
  Shield,
  Droplets,
  ArrowUpRight,
  Fingerprint,
  ArrowRight,
  Sparkles,
  Zap,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CreateWalletModal } from '@/components/CreateWalletModal';
import { WalletSelectModal } from '@/components/WalletSelectModal';
import { useTempo } from '@/hooks/useTempo';
import { getExplorerAddressUrl, fundFromFaucet } from '@/lib/tempo-client';
import { getConnectedApps } from '@/lib/connected-apps';
import { formatAddress, formatAmount, copyToClipboard } from '@/lib/utils';
import { LINKS, DEFAULT_FEE_TOKEN_ADDRESS } from '@/lib/constants';
import type { ConnectedApp } from '@/types';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage(): ReactElement {
  const {
    isConnected,
    isConnecting,
    address,
    signUp,
    signIn,
    connectInjected,
    disconnect,
    hasInjectedWallet,
  } = useTempo();

  const { data: balance } = useBalance({
    address,
    token: DEFAULT_FEE_TOKEN_ADDRESS,
    query: { enabled: !!address },
  });

  const [showCreateWalletModal, setShowCreateWalletModal] = useState(false);
  const [showWalletSelectModal, setShowWalletSelectModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [connectedApps, setConnectedApps] = useState<ConnectedApp[]>([]);
  const [isFunding, setIsFunding] = useState(false);

  // Load connected apps
  useEffect(() => {
    if (isConnected) {
      const apps = getConnectedApps();
      setConnectedApps(apps);
    }
  }, [isConnected]);

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

  const handleInjectedConnect = async (): Promise<void> => {
    setShowWalletSelectModal(false);
    try {
      await connectInjected();
    } catch (err) {
      console.error('Wallet connection error:', err);
      const message = err instanceof Error ? err.message : 'Connection failed';
      if (message.includes('User rejected') || message.includes('rejected')) {
        toast.error('Connection cancelled');
      } else if (message.includes('Chain not configured')) {
        toast.error('Please add Tempo network to your wallet');
      } else {
        toast.error(message);
      }
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setConnectedApps([]);
  };

  const handleCopyAddress = async () => {
    if (!address) return;
    const success = await copyToClipboard(address);
    if (success) {
      setCopied(true);
      toast.success('Address copied');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleFaucet = async () => {
    if (!address) return;

    setIsFunding(true);
    try {
      await fundFromFaucet(address);
      toast.success('Faucet tokens received!');
    } catch (error) {
      console.error('Faucet failed:', error);
      toast.error('Faucet request failed');
    } finally {
      setIsFunding(false);
    }
  };

  // Not connected - show sign in/create wallet page
  if (!isConnected) {
    return (
      <>
        {/* Header */}
        <div className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 py-4 sm:py-6">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="flex items-center gap-2.5"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full" />
                <Zap className="relative w-5 h-5 text-primary" strokeWidth={2.5} />
              </div>
              <span className="text-base font-bold text-slate-900 tracking-tight">
                Temporium
                <span className="text-slate-400 font-normal"> | Wallet</span>
              </span>
            </motion.div>
          </div>
        </div>

        <main className="min-h-screen flex flex-col justify-center px-4 sm:px-6 pt-20 pb-12">
          {/* Background */}
          <div className="fixed inset-0 -z-10 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50/80" />
            <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-primary/8 rounded-full blur-[100px] -translate-y-1/2" />
            <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] bg-blue-500/6 rounded-full blur-[80px] translate-y-1/3" />
          </div>

          <div className="max-w-sm mx-auto w-full">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              {/* Icon */}
              <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Wallet className="w-10 h-10 text-primary" />
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
          hasInjectedWallet={hasInjectedWallet}
          onClose={() => setShowWalletSelectModal(false)}
          onSelectPasskey={handlePasskeySignIn}
          onSelectInjected={handleInjectedConnect}
        />
      </>
    );
  }

  // Connected - show wallet dashboard
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold">Temporium Wallet</h1>
              <p className="text-xs text-muted-foreground">Tempo Testnet</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleDisconnect} className="text-muted-foreground">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto p-4 space-y-6">
        {/* Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-border/50 rounded-2xl p-6 shadow-sm"
        >
          <div className="text-center mb-6">
            <p className="text-sm text-muted-foreground mb-1">Balance</p>
            <h2 className="text-4xl font-bold">
              {balance ? formatAmount(balance.value, balance.decimals, 2) : '0.00'}
              <span className="text-lg text-muted-foreground ml-2">USD</span>
            </h2>
          </div>

          {/* Address */}
          <div className="bg-muted/50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Your Address</p>
                <p className="font-mono text-sm truncate">{formatAddress(address!, 8)}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleCopyAddress}
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowQR(true)}
                >
                  <QrCode className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <Button variant="outline" onClick={handleFaucet} isLoading={isFunding}>
              <Droplets className="w-4 h-4 mr-2" />
              Faucet
            </Button>
            <a
              href={getExplorerAddressUrl(address!)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" className="w-full">
                <ExternalLink className="w-4 h-4 mr-2" />
                Explorer
              </Button>
            </a>
          </div>
        </motion.div>

        {/* Connected Apps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white border border-border/50 rounded-2xl p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Connected Apps</h3>
            </div>
            <Link to="/manage">
              <Button variant="ghost" size="sm">
                Manage
                <ArrowUpRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>

          {connectedApps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No apps connected yet
            </p>
          ) : (
            <div className="space-y-2">
              {connectedApps.slice(0, 3).map(app => (
                <div
                  key={app.id}
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                >
                  <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                    {app.icon ? (
                      <img src={app.icon} alt={app.name} className="w-5 h-5" />
                    ) : (
                      <div className="w-5 h-5 rounded bg-primary/10" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{app.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{app.url}</p>
                  </div>
                </div>
              ))}
              {connectedApps.length > 3 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  +{connectedApps.length - 3} more apps
                </p>
              )}
            </div>
          )}
        </motion.div>

        {/* Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center text-xs text-muted-foreground"
        >
          <p>
            This wallet can be used to connect to any Tempo app.
            <br />
            Your passkey works across all Temporium services.
          </p>
        </motion.div>
      </main>

      {/* QR Code Dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-xs">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-center">Your Address</DialogTitle>
          </DialogHeader>
          <div className="p-6 flex flex-col items-center">
            <div className="bg-white p-4 rounded-xl border border-border/50">
              <QRCodeSVG value={address!} size={180} />
            </div>
            <p className="mt-4 text-sm font-mono text-center break-all">{address}</p>
            <Button className="w-full mt-4" onClick={handleCopyAddress}>
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Address
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
