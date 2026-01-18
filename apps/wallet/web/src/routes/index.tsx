import { type ReactElement, useState, useEffect } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet,
  Copy,
  Check,
  LogOut,
  Settings,
  ExternalLink,
  QrCode,
  Shield,
  Droplets,
  ArrowUpRight,
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
import { tempoPasskeyConnector } from '@/lib/wagmi';
import { tempoChain, getExplorerAddressUrl, fundFromFaucet } from '@/lib/tempo-client';
import { getConnectedApps } from '@/lib/connected-apps';
import { clearAuthToken } from '@/lib/auth-storage';
import { formatAddress, formatAmount, copyToClipboard } from '@/lib/utils';
import { LINKS, DEFAULT_FEE_TOKEN_ADDRESS } from '@/lib/constants';
import type { ConnectedApp } from '@/types';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage(): ReactElement {
  const { address, isConnected } = useAccount();
  const { connectAsync, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({
    address,
    token: DEFAULT_FEE_TOKEN_ADDRESS,
    query: { enabled: !!address },
  });

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

  const handleConnect = async () => {
    try {
      await connectAsync({ connector: tempoPasskeyConnector });
    } catch (error) {
      console.error('Connection failed:', error);
      toast.error('Failed to connect wallet');
    }
  };

  const handleDisconnect = () => {
    clearAuthToken();
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

  // Not connected - show sign in
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Wallet className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Temporium Wallet</h1>
            <p className="text-muted-foreground">
              Secure passkey-based wallet for the Tempo blockchain
            </p>
          </div>

          <div className="bg-white border border-border/50 rounded-2xl p-6 shadow-sm">
            <Button
              className="w-full h-12 text-base"
              onClick={handleConnect}
              isLoading={isConnecting}
            >
              Sign In with Passkey
            </Button>

            <div className="mt-6 pt-6 border-t border-border/50">
              <p className="text-xs text-muted-foreground text-center mb-4">
                Your wallet is secured with passkeys. No passwords to remember.
              </p>
              <div className="flex justify-center gap-4">
                <a
                  href={LINKS.docs}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  Learn More
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Connected - show wallet
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
