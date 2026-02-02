import { type ReactElement, useState, useEffect, useCallback, useRef } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader2, Fingerprint, Plus, Clock, Globe } from 'lucide-react';
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
  createPendingRequest,
  WalletConnectErrorCode,
  createErrorResponse,
} from '@/lib/wallet-connect';
import { isAppConnected } from '@/lib/connected-apps';
import type { ConnectRequest, PendingRequest } from '@/types';
import { formatAddress } from '@/lib/utils';

export const Route = createFileRoute('/connect')({
  component: ConnectPage,
});

function ConnectPage(): ReactElement {
  const navigate = useNavigate();
  const { isConnected, isConnecting, address, signUp, signIn, connectInjected, hasInjectedWallet } =
    useTempo();

  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [status, setStatus] = useState<
    'waiting' | 'processing' | 'success' | 'error' | 'rejected' | 'timeout'
  >('waiting');
  const [error, setError] = useState<string | null>(null);
  const [sourceWindow, setSourceWindow] = useState<Window | null>(null);
  const [sourceOrigin, setSourceOrigin] = useState<string | null>(null);
  const [showCreateWalletModal, setShowCreateWalletModal] = useState(false);
  const [showWalletSelectModal, setShowWalletSelectModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'connect' | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const completeConnection = useCallback(
    async (
      request: ConnectRequest,
      walletAddress: string,
      origin?: string,
      targetWindow?: Window
    ) => {
      const effectiveOrigin = origin || sourceOrigin;
      const effectiveWindow = targetWindow || sourceWindow;

      if (!effectiveOrigin) {
        console.error('[Connect] No origin available');
        return;
      }

      setStatus('processing');

      try {
        const response = approveConnect(request, walletAddress as `0x${string}`, tempoChain.id);
        console.log('[Connect] Sending approval response:', { origin: effectiveOrigin, response });

        if (effectiveWindow) {
          sendResponse(effectiveOrigin, response, effectiveWindow);
        }

        setStatus('success');
        setTimeout(() => window.close(), 2000);
      } catch (err) {
        console.error('[Connect] Approval failed:', err);
        setError(err instanceof Error ? err.message : 'Connection failed');
        setStatus('error');
      }
    },
    [sourceOrigin, sourceWindow]
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent): void => {
      const parsed = parseMessage(event);
      if (!parsed) return;

      const { request, origin } = parsed;

      // Handle verify_connection requests immediately (lightweight check)
      if (request.method === 'verify_connection') {
        const isStillConnected = isAppConnected(origin);
        const response = isStillConnected
          ? { id: request.id, success: true, result: { valid: true, address } }
          : createErrorResponse(
              request.id,
              'App not connected',
              WalletConnectErrorCode.CONNECTION_REVOKED
            );

        if (event.source) {
          sendResponse(origin, response, event.source as Window);
        }
        // Give enough time for the message to be sent before closing
        setTimeout(() => window.close(), 500);
        return;
      }

      if (request.method !== 'connect') {
        return;
      }

      console.log('[Connect] Received connect request from:', origin);

      const connectRequest = request as ConnectRequest;
      const pending = createPendingRequest(connectRequest, origin);

      setPendingRequest(pending);
      setSourceWindow(event.source as Window);
      setSourceOrigin(origin);
      setStatus('waiting');
      setError(null);

      const { autoApprove } = handleConnectRequest(connectRequest, origin);

      if (autoApprove && isConnected && address) {
        completeConnection(connectRequest, address, origin, event.source as Window);
      }
    };

    window.addEventListener('message', handleMessage);

    if (window.opener) {
      window.opener.postMessage({ type: 'TEMPO_WALLET_READY', version: '1.0.0' }, '*');
    }

    return () => window.removeEventListener('message', handleMessage);
  }, [isConnected, address, completeConnection]);

  useEffect(() => {
    if (pendingAction === 'connect' && isConnected && address && pendingRequest && !isConnecting) {
      setPendingAction(null);
      completeConnection(pendingRequest.request as ConnectRequest, address);
    }
  }, [isConnected, address, pendingAction, pendingRequest, isConnecting, completeConnection]);

  useEffect(() => {
    if (!pendingRequest || status !== 'waiting') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setTimeRemaining(null);
      return;
    }

    const timeoutMs = TIMING.CONNECTION_TIMEOUT_MS;
    const endTime = Date.now() + timeoutMs;
    setTimeRemaining(Math.ceil(timeoutMs / 1000));

    timerRef.current = setInterval(() => {
      const remaining = Math.ceil((endTime - Date.now()) / 1000);
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeRemaining(0);
        setStatus('timeout');

        if (sourceWindow && sourceOrigin && pendingRequest) {
          const response = createErrorResponse(
            pendingRequest.request.id,
            'Connection request timed out',
            WalletConnectErrorCode.CONNECTION_TIMEOUT
          );
          sendResponse(sourceOrigin, response, sourceWindow);
        }
        setTimeout(() => window.close(), 2000);
      } else {
        setTimeRemaining(remaining);
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pendingRequest, status, sourceWindow, sourceOrigin]);

  const handleReject = useCallback(() => {
    if (!pendingRequest || !sourceOrigin) return;

    const response = createErrorResponse(
      pendingRequest.request.id,
      'User rejected connection',
      WalletConnectErrorCode.USER_REJECTED
    );
    if (sourceWindow) sendResponse(sourceOrigin, response, sourceWindow);

    setStatus('rejected');
    setTimeout(() => window.close(), 1000);
  }, [pendingRequest, sourceOrigin, sourceWindow]);

  // Handle window close as rejection
  useEffect(() => {
    if (!pendingRequest || status !== 'waiting' || !sourceWindow || !sourceOrigin) return;

    const handleBeforeUnload = (): void => {
      // Send rejection response when window is closed
      sendResponse(
        sourceOrigin,
        createErrorResponse(
          pendingRequest.request.id,
          'User closed the wallet window',
          WalletConnectErrorCode.USER_REJECTED
        ),
        sourceWindow
      );
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pendingRequest, status, sourceWindow, sourceOrigin]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!pendingRequest || status !== 'waiting') return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (showCreateWalletModal || showWalletSelectModal) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Enter' && isConnected && address) {
        e.preventDefault();
        completeConnection(pendingRequest.request as ConnectRequest, address);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleReject();
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
    handleReject,
  ]);

  const handleApprove = useCallback(() => {
    if (!pendingRequest || !sourceOrigin) return;

    if (isConnected && address) {
      completeConnection(pendingRequest.request as ConnectRequest, address);
    } else {
      setShowWalletSelectModal(true);
    }
  }, [pendingRequest, sourceOrigin, isConnected, address, completeConnection]);

  const handleCreateWallet = async (walletName?: string): Promise<void> => {
    try {
      setPendingAction('connect');
      await signUp(walletName);
      setShowCreateWalletModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Wallet creation cancelled');
      setPendingAction(null);
    }
  };

  const handlePasskeySignIn = async (): Promise<void> => {
    setShowWalletSelectModal(false);
    try {
      setPendingAction('connect');
      await signIn();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      toast.error(
        message.includes('publicKey not found')
          ? 'Passkey not found. Create a wallet first.'
          : message
      );
      setPendingAction(null);
    }
  };

  const handleInjectedConnect = async (): Promise<void> => {
    setShowWalletSelectModal(false);
    try {
      setPendingAction('connect');
      await connectInjected();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      toast.error(message.includes('rejected') ? 'Connection cancelled' : message);
      setPendingAction(null);
    }
  };

  // Status screens
  if (!pendingRequest) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[360px]"
        >
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
            <h1 className="text-[15px] font-semibold text-gray-900 mb-1">Waiting for Connection</h1>
            <p className="text-[13px] text-gray-500 mb-5">
              Waiting for an app to request connection...
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: '/' })}
              className="w-full"
            >
              Go to Wallet
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-[360px]"
        >
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-[15px] font-semibold text-gray-900 mb-1">Connected</h1>
            <p className="text-[13px] text-gray-500">
              Successfully connected to {pendingRequest.appInfo.name}
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-[360px]"
        >
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-6 h-6 text-gray-500" />
            </div>
            <h1 className="text-[15px] font-semibold text-gray-900 mb-1">Connection Rejected</h1>
            <p className="text-[13px] text-gray-500">You declined to connect</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (status === 'timeout') {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-[360px]"
        >
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-6 h-6 text-gray-500" />
            </div>
            <h1 className="text-[15px] font-semibold text-gray-900 mb-1">Request Timed Out</h1>
            <p className="text-[13px] text-gray-500">The connection request has expired</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-[360px]"
        >
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-6 h-6 text-gray-500" />
            </div>
            <h1 className="text-[15px] font-semibold text-gray-900 mb-1">Connection Failed</h1>
            <p className="text-[13px] text-gray-500 mb-5">{error || 'Something went wrong'}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => window.close()}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => {
                  setStatus('waiting');
                  setError(null);
                }}
              >
                Try Again
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Main connection request UI
  return (
    <>
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[360px]"
        >
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  {pendingRequest.appInfo.icon ? (
                    <img src={pendingRequest.appInfo.icon} alt="" className="w-6 h-6 rounded" />
                  ) : (
                    <Globe className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-gray-900 truncate">
                    {pendingRequest.appInfo.name}
                  </p>
                  <p className="text-[12px] text-gray-500 truncate">{pendingRequest.appInfo.url}</p>
                </div>
              </div>
              <h1 className="text-[15px] font-semibold text-gray-900">Connect your wallet</h1>
              <p className="text-[13px] text-gray-500 mt-1">
                This app would like to connect to your wallet
              </p>
            </div>

            {/* Permissions */}
            <div className="p-5 border-b border-gray-100">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-3">
                This app will be able to
              </p>
              <div className="space-y-2">
                {[
                  'View your wallet address',
                  'Request transaction approval',
                  'Request message signatures',
                ].map(perm => (
                  <div key={perm} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-[13px] text-gray-700">{perm}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Wallet Status */}
            <div className="p-5 border-b border-gray-100">
              {isConnected && address ? (
                <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-gray-700">Wallet Connected</p>
                    <p className="text-[12px] font-mono text-primary">
                      {formatAddress(address, 6)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-[13px] font-medium text-gray-700 mb-3">Sign in to connect</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-9 text-[13px]"
                      onClick={() => setShowWalletSelectModal(true)}
                      disabled={isConnecting}
                    >
                      <Fingerprint className="w-4 h-4 mr-1.5" />
                      Sign In
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 h-9 text-[13px]"
                      onClick={() => setShowCreateWalletModal(true)}
                      disabled={isConnecting}
                    >
                      <Plus className="w-4 h-4 mr-1.5" />
                      Create
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Timer */}
            {timeRemaining !== null && timeRemaining > 0 && (
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center justify-center gap-1.5 text-[12px] text-gray-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    Expires in {Math.floor(timeRemaining / 60)}:
                    {(timeRemaining % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="p-5 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-10"
                onClick={handleReject}
                disabled={status === 'processing' || isConnecting}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-10"
                onClick={handleApprove}
                isLoading={status === 'processing' || isConnecting}
              >
                {isConnected ? 'Connect' : 'Sign In to Connect'}
              </Button>
            </div>

            {/* Keyboard hints */}
            {isConnected && status === 'waiting' && (
              <div className="px-5 pb-4 flex items-center justify-center gap-4 text-[11px] text-gray-400">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono">
                    Enter
                  </kbd>
                  <span>connect</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Esc</kbd>
                  <span>cancel</span>
                </span>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <CreateWalletModal
        isOpen={showCreateWalletModal}
        isLoading={isConnecting}
        onClose={() => setShowCreateWalletModal(false)}
        onCreateWallet={handleCreateWallet}
      />

      <WalletSelectModal
        isOpen={showWalletSelectModal}
        isLoading={isConnecting}
        onClose={() => setShowWalletSelectModal(false)}
        onSelectPasskey={handlePasskeySignIn}
        onCreateWallet={() => setShowCreateWalletModal(true)}
        onInjectedConnect={handleInjectedConnect}
        hasInjectedWallet={hasInjectedWallet}
      />
    </>
  );
}
