import { type ReactElement, useState, useEffect, useCallback, useRef } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import {
  Shield,
  CheckCircle,
  XCircle,
  Globe,
  Loader2,
  Fingerprint,
  Sparkles,
  ArrowRight,
  Wallet,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CreateWalletModal } from '@/components/CreateWalletModal';
import { WalletSelectModal } from '@/components/WalletSelectModal';
import { useTempo } from '@/hooks/useTempo';
import { tempoChain } from '@/lib/tempo-client';
import { TIMING } from '@/lib/constants';
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
  const {
    isConnected,
    isConnecting,
    address,
    signUp,
    signIn,
    connectInjected,
    hasInjectedWallet,
  } = useTempo();

  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [status, setStatus] = useState<'waiting' | 'processing' | 'success' | 'error' | 'rejected' | 'timeout'>('waiting');
  const [error, setError] = useState<string | null>(null);
  const [sourceWindow, setSourceWindow] = useState<Window | null>(null);
  const [sourceOrigin, setSourceOrigin] = useState<string | null>(null);
  const [showCreateWalletModal, setShowCreateWalletModal] = useState(false);
  const [showWalletSelectModal, setShowWalletSelectModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'connect' | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Timer ref for cleanup
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const completeConnection = useCallback(
    async (request: ConnectRequest, walletAddress: string) => {
      if (!sourceOrigin) return;

      setStatus('processing');

      try {
        // Create approval response
        const response = approveConnect(request, walletAddress as `0x${string}`, tempoChain.id);

        // Send response back to requesting app
        if (sourceWindow) {
          sendResponse(sourceOrigin, response, sourceWindow);
        }

        setStatus('success');

        // Close window after delay (giving user time to see success)
        setTimeout(() => {
          window.close();
        }, 2000);
      } catch (err) {
        console.error('[Connect] Approval failed:', err);
        setError(err instanceof Error ? err.message : 'Connection failed');
        setStatus('error');
      }
    },
    [sourceOrigin, sourceWindow]
  );

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
      // Reset any previous error state
      setStatus('waiting');
      setError(null);

      // Check if auto-approve (already connected)
      const { autoApprove } = handleConnectRequest(connectRequest, origin);

      if (autoApprove && isConnected && address) {
        // Auto-approve for already connected apps
        completeConnection(connectRequest, address);
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
  }, [isConnected, address, completeConnection]);

  // When user completes authentication, proceed with connection
  useEffect(() => {
    if (pendingAction === 'connect' && isConnected && address && pendingRequest && !isConnecting) {
      setPendingAction(null);
      completeConnection(pendingRequest.request as ConnectRequest, address);
    }
  }, [isConnected, address, pendingAction, pendingRequest, isConnecting, completeConnection]);

  // Request timeout countdown
  useEffect(() => {
    if (!pendingRequest || status !== 'waiting') {
      // Clear timer if no request or not in waiting state
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setTimeRemaining(null);
      return;
    }

    // Start countdown
    const timeoutMs = TIMING.CONNECTION_TIMEOUT_MS;
    const endTime = Date.now() + timeoutMs;
    setTimeRemaining(Math.ceil(timeoutMs / 1000));

    timerRef.current = setInterval(() => {
      const remaining = Math.ceil((endTime - Date.now()) / 1000);
      if (remaining <= 0) {
        // Timeout expired
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setTimeRemaining(0);
        setStatus('timeout');

        // Send timeout response
        if (sourceWindow && sourceOrigin && pendingRequest) {
          const response = rejectConnect(
            pendingRequest.request as ConnectRequest,
            'Request timed out'
          );
          sendResponse(sourceOrigin, response, sourceWindow);
        }

        // Close window after delay
        setTimeout(() => window.close(), 2000);
      } else {
        setTimeRemaining(remaining);
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [pendingRequest, status, sourceWindow, sourceOrigin]);

  // Keyboard shortcuts (Enter to approve, Escape to reject)
  useEffect(() => {
    if (!pendingRequest || status !== 'waiting') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if modal is open or user is typing
      if (showCreateWalletModal || showWalletSelectModal) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Enter' && isConnected && address) {
        e.preventDefault();
        completeConnection(pendingRequest.request as ConnectRequest, address);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        const request = pendingRequest.request as ConnectRequest;
        const response = rejectConnect(request, 'User rejected connection');
        if (sourceWindow && sourceOrigin) {
          sendResponse(sourceOrigin, response, sourceWindow);
        }
        setStatus('rejected');
        setTimeout(() => window.close(), 1000);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    pendingRequest,
    status,
    isConnected,
    address,
    showCreateWalletModal,
    showWalletSelectModal,
    sourceWindow,
    sourceOrigin,
    completeConnection,
  ]);

  const handleApprove = useCallback(() => {
    if (!pendingRequest || !sourceOrigin) return;

    if (isConnected && address) {
      // Already connected, complete immediately
      completeConnection(pendingRequest.request as ConnectRequest, address);
    } else {
      // Need to authenticate first - show wallet select modal
      setShowWalletSelectModal(true);
    }
  }, [pendingRequest, sourceOrigin, isConnected, address, completeConnection]);

  const handleCreateWallet = async (walletName?: string): Promise<void> => {
    try {
      setPendingAction('connect');
      await signUp(walletName);
      setShowCreateWalletModal(false);
      // Connection will be completed by useEffect when isConnected becomes true
    } catch (err) {
      console.error('Wallet creation error:', err);
      toast.error(err instanceof Error ? err.message : 'Wallet creation cancelled');
      setPendingAction(null);
    }
  };

  const handlePasskeySignIn = async (): Promise<void> => {
    setShowWalletSelectModal(false);
    try {
      setPendingAction('connect');
      await signIn();
      // Connection will be completed by useEffect when isConnected becomes true
    } catch (err) {
      console.error('Sign in error:', err);
      const message = err instanceof Error ? err.message : 'Sign in failed';
      if (message.includes('publicKey not found')) {
        toast.error('Passkey not found. Please create a wallet first.');
      } else {
        toast.error(message);
      }
      setPendingAction(null);
    }
  };

  const handleInjectedConnect = async (): Promise<void> => {
    setShowWalletSelectModal(false);
    try {
      setPendingAction('connect');
      await connectInjected();
      // Connection will be completed by useEffect when isConnected becomes true
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
      setPendingAction(null);
    }
  };

  const handleReject = useCallback(() => {
    if (!pendingRequest || !sourceOrigin) return;

    const request = pendingRequest.request as ConnectRequest;
    const response = rejectConnect(request, 'User rejected connection');

    if (sourceWindow) {
      sendResponse(sourceOrigin, response, sourceWindow);
    }

    setStatus('rejected');

    // Close window after short delay
    setTimeout(() => {
      window.close();
    }, 1000);
  }, [pendingRequest, sourceOrigin, sourceWindow]);

  const handleRetry = useCallback(() => {
    setStatus('waiting');
    setError(null);
  }, []);

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

  // Rejected state (user explicitly rejected)
  if (status === 'rejected') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm"
        >
          <div className="bg-white border border-border/50 rounded-2xl p-8 text-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="text-xl font-semibold mb-2">Connection Rejected</h1>
            <p className="text-sm text-muted-foreground">
              You declined to connect to {pendingRequest?.appInfo.name || 'the app'}
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Timeout state
  if (status === 'timeout') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm"
        >
          <div className="bg-white border border-border/50 rounded-2xl p-8 text-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
              <Clock className="w-8 h-8 text-gray-600" />
            </div>
            <h1 className="text-xl font-semibold mb-2">Request Timed Out</h1>
            <p className="text-sm text-muted-foreground">
              The connection request from {pendingRequest?.appInfo.name || 'the app'} has expired
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Error state (actual error occurred)
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
            <p className="text-sm text-muted-foreground mb-6">{error || 'Something went wrong'}</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => window.close()}>
                Close
              </Button>
              <Button className="flex-1" onClick={handleRetry}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Connection request UI
  return (
    <>
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

              {/* Connected wallet info or sign in prompt */}
              {isConnected && address ? (
                <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <p className="text-xs font-medium text-green-700">Wallet Connected</p>
                  </div>
                  <p className="text-sm font-mono text-green-800">{formatAddress(address, 8)}</p>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="w-4 h-4 text-amber-600" />
                    <p className="text-xs font-medium text-amber-700">Wallet Required</p>
                  </div>
                  <p className="text-sm text-amber-800 mb-3">
                    Sign in to your wallet or create a new one to connect.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-9 text-xs bg-white"
                      onClick={() => setShowWalletSelectModal(true)}
                      disabled={isConnecting}
                    >
                      <Fingerprint className="w-3.5 h-3.5 mr-1.5" />
                      Sign In
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 h-9 text-xs"
                      onClick={() => setShowCreateWalletModal(true)}
                      disabled={isConnecting}
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                      Create Wallet
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Timeout Countdown */}
            {timeRemaining !== null && timeRemaining > 0 && (
              <div className="px-6 pb-3">
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    Request expires in{' '}
                    <span className={timeRemaining <= 10 ? 'text-amber-600 font-medium' : ''}>
                      {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                    </span>
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="p-6 pt-0 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11"
                onClick={handleReject}
                disabled={status === 'processing' || isConnecting}
              >
                Reject
              </Button>
              <Button
                className="flex-1 h-11"
                onClick={handleApprove}
                isLoading={status === 'processing' || isConnecting}
                disabled={!isConnected}
              >
                {isConnected ? (
                  <>
                    Connect
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                ) : (
                  'Sign In First'
                )}
              </Button>
            </div>

            {/* Keyboard hints */}
            {isConnected && status === 'waiting' && (
              <div className="px-6 pb-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Enter</kbd>
                  <span>to connect</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Esc</kbd>
                  <span>to reject</span>
                </span>
              </div>
            )}
          </div>
        </motion.div>
      </div>

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
        onCreateWallet={() => setShowCreateWalletModal(true)}
      />
    </>
  );
}
