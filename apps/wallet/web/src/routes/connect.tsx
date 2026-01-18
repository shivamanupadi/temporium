import { type ReactElement, useState, useEffect, useCallback } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { motion } from 'framer-motion';
import { Shield, CheckCircle, XCircle, Globe, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { tempoPasskeyConnector } from '@/lib/wagmi';
import { tempoChain } from '@/lib/tempo-client';
import {
  parseMessage,
  sendResponse,
  handleConnectRequest,
  approveConnect,
  rejectConnect,
  createPendingRequest,
} from '@/lib/wallet-connect';
import type { ConnectRequest, PendingRequest } from '@/types';
import { formatAddress } from '@/lib/utils';

export const Route = createFileRoute('/connect')({
  component: ConnectPage,
});

function ConnectPage(): ReactElement {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { connectAsync } = useConnect();
  const { disconnect } = useDisconnect();

  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [status, setStatus] = useState<'waiting' | 'processing' | 'success' | 'error'>('waiting');
  const [error, setError] = useState<string | null>(null);
  const [sourceWindow, setSourceWindow] = useState<Window | null>(null);
  const [sourceOrigin, setSourceOrigin] = useState<string | null>(null);

  // Listen for incoming connection requests
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const parsed = parseMessage(event);
      if (!parsed) return;

      const { request, origin } = parsed;

      // Only handle connect requests on this page
      if (request.method !== 'connect') {
        console.log('[Connect] Ignoring non-connect request:', request.method);
        return;
      }

      console.log('[Connect] Received connect request from:', origin);

      const connectRequest = request as ConnectRequest;
      const pending = createPendingRequest(connectRequest, origin);

      setPendingRequest(pending);
      setSourceWindow(event.source as Window);
      setSourceOrigin(origin);

      // Check if auto-approve (already connected)
      const { autoApprove } = handleConnectRequest(connectRequest, origin);

      if (autoApprove && isConnected && address) {
        // Auto-approve for already connected apps
        handleApprove(connectRequest);
      }
    };

    window.addEventListener('message', handleMessage);

    // Notify opener that wallet is ready
    if (window.opener) {
      window.opener.postMessage(
        { type: 'TEMPO_WALLET_READY', version: '1.0.0' },
        '*'
      );
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [isConnected, address]);

  const handleApprove = useCallback(
    async (request?: ConnectRequest) => {
      const req = request || (pendingRequest?.request as ConnectRequest);
      if (!req || !sourceOrigin) return;

      setStatus('processing');

      try {
        // Ensure wallet is connected
        let walletAddress = address;

        if (!isConnected || !walletAddress) {
          const result = await connectAsync({ connector: tempoPasskeyConnector });
          walletAddress = result.accounts[0];
        }

        if (!walletAddress) {
          throw new Error('Failed to get wallet address');
        }

        // Create approval response
        const response = approveConnect(req, walletAddress, tempoChain.id);

        // Send response back to requesting app
        if (sourceWindow) {
          sendResponse(sourceOrigin, response, sourceWindow);
        }

        setStatus('success');

        // Close window after short delay
        setTimeout(() => {
          window.close();
        }, 1500);
      } catch (err) {
        console.error('[Connect] Approval failed:', err);
        setError(err instanceof Error ? err.message : 'Connection failed');
        setStatus('error');
      }
    },
    [pendingRequest, sourceOrigin, sourceWindow, address, isConnected, connectAsync]
  );

  const handleReject = useCallback(() => {
    if (!pendingRequest || !sourceOrigin) return;

    const request = pendingRequest.request as ConnectRequest;
    const response = rejectConnect(request, 'User rejected connection');

    if (sourceWindow) {
      sendResponse(sourceOrigin, response, sourceWindow);
    }

    setStatus('error');
    setError('Connection rejected');

    // Close window after short delay
    setTimeout(() => {
      window.close();
    }, 1000);
  }, [pendingRequest, sourceOrigin, sourceWindow]);

  const handleGoToWallet = () => {
    navigate({ to: '/' });
  };

  // No pending request - show waiting state or redirect to wallet
  if (!pendingRequest) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="bg-white border border-border/50 rounded-2xl p-8 text-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
            </div>
            <h1 className="text-xl font-semibold mb-2">Waiting for Connection</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Waiting for an app to request connection...
            </p>
            <Button variant="outline" onClick={handleGoToWallet} className="w-full">
              Go to Wallet
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Success state
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm"
        >
          <div className="bg-white border border-border/50 rounded-2xl p-8 text-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-xl font-semibold mb-2">Connected</h1>
            <p className="text-sm text-muted-foreground">
              Successfully connected to {pendingRequest.appInfo.name}
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm"
        >
          <div className="bg-white border border-border/50 rounded-2xl p-8 text-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-xl font-semibold mb-2">Connection Failed</h1>
            <p className="text-sm text-muted-foreground">{error || 'Something went wrong'}</p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Connection request UI
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="bg-white border border-border/50 rounded-2xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-border/50">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                {pendingRequest.appInfo.icon ? (
                  <img
                    src={pendingRequest.appInfo.icon}
                    alt={pendingRequest.appInfo.name}
                    className="w-10 h-10 rounded-lg"
                  />
                ) : (
                  <Globe className="w-8 h-8 text-primary" />
                )}
              </div>
            </div>
            <h1 className="text-xl font-semibold text-center mb-1">
              Connect to {pendingRequest.appInfo.name}
            </h1>
            <p className="text-sm text-muted-foreground text-center">
              {pendingRequest.appInfo.url}
            </p>
          </div>

          {/* Permissions */}
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">This app will be able to:</p>
                <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                  <li>• View your wallet address</li>
                  <li>• Request transaction signatures</li>
                  <li>• Request message signatures</li>
                </ul>
              </div>
            </div>

            {isConnected && address && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Connected Wallet</p>
                <p className="text-sm font-mono font-medium">{formatAddress(address, 8)}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-6 pt-0 flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleReject}
              disabled={status === 'processing'}
            >
              Reject
            </Button>
            <Button
              className="flex-1"
              onClick={() => handleApprove()}
              isLoading={status === 'processing'}
            >
              {isConnected ? 'Connect' : 'Sign In & Connect'}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
