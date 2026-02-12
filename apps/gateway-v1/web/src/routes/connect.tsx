import { type ReactElement, useState, useEffect, useCallback, useRef } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  XCircle,
  Loader2,
  Fingerprint,
  Plus,
  Clock,
  Globe,
  Link2,
  PenTool,
  Send,
  Eye,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CreateWalletModal } from '@temporium/shared-ui';
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
} from '@/lib/gateway-connect-protocol';
import { isAppConnected } from '@/lib/connected-apps';
import type { ConnectRequest, PendingRequest } from '@/types';
import { formatAddress } from '@/lib/utils';

export const Route = createFileRoute('/connect')({
  component: ConnectPage,
});

const PERMISSIONS = [
  {
    icon: Eye,
    label: 'View your wallet address',
    color: '#5B9A6F',
    type: 'connect' as const,
  },
  {
    icon: Send,
    label: 'Request transaction approval',
    color: '#E07A5F',
    type: 'send' as const,
  },
  {
    icon: PenTool,
    label: 'Request message signatures',
    color: '#E07A5F',
    type: 'sign' as const,
  },
];

function ConnectPage(): ReactElement {
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

      // Handle verify_connection requests immediately
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
        setTimeout(() => window.close(), 500);
        return;
      }

      if (request.method !== 'connect') {
        return;
      }

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

  // --- Status screens ---

  if (!pendingRequest) {
    return (
      <div className="min-h-screen bg-[#FDFBF8] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[380px]"
        >
          <div className="bg-white rounded-2xl border border-[#EDE9E3] shadow-sm overflow-hidden">
            <div className="px-6 py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#5B9A6F]/8 flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-6 h-6 text-[#5B9A6F] animate-spin" />
              </div>
              <h1 className="text-[16px] font-semibold text-[#2D3436] mb-1.5">
                Waiting for Connection
              </h1>
              <p className="text-[13px] text-[#9B9590] mb-6">
                Waiting for an app to request connection...
              </p>
              <Button
                variant="outline"
                onClick={() => window.close()}
                className="h-11 px-6 rounded-xl text-[13px] border-[#EDE9E3]"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Close
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-[#FDFBF8] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="w-full max-w-[380px]"
        >
          <div className="bg-white rounded-2xl border border-[#EDE9E3] shadow-sm overflow-hidden">
            <div className="relative px-6 py-12 text-center">
              <div className="absolute inset-0 bg-gradient-to-b from-[#5B9A6F]/[0.04] to-transparent pointer-events-none" />
              <div className="relative">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                  className="w-16 h-16 rounded-2xl bg-[#5B9A6F]/10 flex items-center justify-center mx-auto mb-4"
                >
                  <CheckCircle className="w-8 h-8 text-[#5B9A6F]" />
                </motion.div>
                <h1 className="text-[17px] font-semibold text-[#2D3436] mb-1.5">Connected!</h1>
                <p className="text-[13px] text-[#9B9590]">
                  Successfully connected to{' '}
                  <span className="font-semibold text-[#2D3436]">
                    {pendingRequest.appInfo.name}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="min-h-screen bg-[#FDFBF8] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-[380px]"
        >
          <div className="bg-white rounded-2xl border border-[#EDE9E3] shadow-sm overflow-hidden">
            <div className="px-6 py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#F5F2ED] flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-7 h-7 text-[#9B9590]" />
              </div>
              <h1 className="text-[16px] font-semibold text-[#2D3436] mb-1.5">
                Connection Declined
              </h1>
              <p className="text-[13px] text-[#9B9590]">You declined the connection request</p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (status === 'timeout') {
    return (
      <div className="min-h-screen bg-[#FDFBF8] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-[380px]"
        >
          <div className="bg-white rounded-2xl border border-[#EDE9E3] shadow-sm overflow-hidden">
            <div className="px-6 py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#F5F2ED] flex items-center justify-center mx-auto mb-4">
                <Clock className="w-7 h-7 text-[#9B9590]" />
              </div>
              <h1 className="text-[16px] font-semibold text-[#2D3436] mb-1.5">Request Expired</h1>
              <p className="text-[13px] text-[#9B9590]">
                The connection request has timed out
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#FDFBF8] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-[380px]"
        >
          <div className="bg-white rounded-2xl border border-[#EDE9E3] shadow-sm overflow-hidden">
            <div className="relative px-6 pt-10 pb-6 text-center">
              <div className="absolute inset-0 bg-gradient-to-b from-red-500/[0.03] to-transparent pointer-events-none" />
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-7 h-7 text-red-500" />
                </div>
                <h1 className="text-[16px] font-semibold text-[#2D3436] mb-1.5">
                  Connection Failed
                </h1>
                <p className="text-[13px] text-[#9B9590]">{error || 'Something went wrong'}</p>
              </div>
            </div>
            <div className="px-5 pb-5 flex items-center gap-2.5">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl text-[13px] border-[#EDE9E3]"
                onClick={() => window.close()}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-[#2D3436] hover:bg-[#3D4446] text-white"
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

  // --- Main connection request UI ---
  return (
    <>
      <div className="min-h-screen bg-[#FDFBF8] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-[380px]"
        >
          <div className="bg-white rounded-2xl border border-[#EDE9E3] shadow-sm overflow-hidden">
            {/* App info + title */}
            <div className="relative px-6 pt-7 pb-5">
              <div className="absolute inset-0 bg-gradient-to-b from-[#5B9A6F]/[0.03] to-transparent pointer-events-none" />

              <div className="relative">
                {/* App icon */}
                <div className="flex justify-center mb-5">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-[#F5F2ED] border border-[#EDE9E3] flex items-center justify-center overflow-hidden">
                      {pendingRequest.appInfo.icon ? (
                        <img
                          src={pendingRequest.appInfo.icon}
                          alt=""
                          className="w-16 h-16 rounded-2xl object-cover"
                        />
                      ) : (
                        <Globe className="w-7 h-7 text-[#9B9590]" />
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-[#5B9A6F] border-2 border-white flex items-center justify-center">
                      <Link2 className="w-3 h-3 text-white" />
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <h1 className="text-[17px] font-semibold text-[#2D3436] mb-1">
                    Connect to {pendingRequest.appInfo.name}
                  </h1>
                  <p className="text-[12px] text-[#9B9590] font-mono">
                    {pendingRequest.appInfo.url}
                  </p>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="mx-6 border-t border-[#EDE9E3]" />

            {/* Permissions */}
            <div className="px-6 py-5">
              <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-widest mb-3.5">
                This app will be able to
              </p>
              <div className="space-y-2.5">
                {PERMISSIONS.map(perm => {
                  const PermIcon = perm.icon;
                  return (
                    <div key={perm.label} className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${perm.color}12` }}
                      >
                        <PermIcon className="w-4 h-4" style={{ color: perm.color }} />
                      </div>
                      <span className="text-[13px] text-[#2D3436] font-medium">{perm.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="mx-6 border-t border-[#EDE9E3]" />

            {/* Wallet status */}
            <div className="px-6 py-5">
              <AnimatePresence mode="wait">
                {isConnected && address ? (
                  <motion.div
                    key="connected"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex items-center gap-3 px-4 py-3 bg-[#5B9A6F]/6 rounded-xl border border-[#5B9A6F]/15"
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#5B9A6F]/12 flex items-center justify-center shrink-0">
                      <Wallet className="w-4 h-4 text-[#5B9A6F]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-[#5B9A6F]">Wallet Ready</p>
                      <p className="text-[11px] font-mono text-[#5B9A6F]/70 truncate">
                        {formatAddress(address, 6)}
                      </p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-[#5B9A6F] shrink-0" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="not-connected"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="bg-[#FDFBF8] rounded-xl border border-[#EDE9E3] px-4 py-4"
                  >
                    <p className="text-[13px] font-semibold text-[#2D3436] mb-3">
                      Sign in to connect
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 h-10 rounded-xl text-[13px] border-[#EDE9E3]"
                        onClick={() => setShowWalletSelectModal(true)}
                        disabled={isConnecting}
                      >
                        <Fingerprint className="w-4 h-4 mr-1.5" />
                        Sign In
                      </Button>
                      <Button
                        className="flex-1 h-10 rounded-xl text-[13px] font-semibold bg-[#2D3436] hover:bg-[#3D4446] text-white"
                        onClick={() => setShowCreateWalletModal(true)}
                        disabled={isConnecting}
                      >
                        <Plus className="w-4 h-4 mr-1.5" />
                        Create
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Timer */}
            {timeRemaining !== null && timeRemaining > 0 && (
              <div className="mx-6 border-t border-[#EDE9E3]" />
            )}
            {timeRemaining !== null && timeRemaining > 0 && (
              <div className="px-6 py-3">
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#B5B0AA]">
                  <Clock className="w-3 h-3" />
                  <span>
                    Expires in {Math.floor(timeRemaining / 60)}:
                    {(timeRemaining % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="mx-6 border-t border-[#EDE9E3]" />

            {/* Actions */}
            <div className="px-5 py-5 flex items-center gap-2.5">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl text-[13px] border-[#EDE9E3]"
                onClick={handleReject}
                disabled={status === 'processing' || isConnecting}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-[#E07A5F] hover:bg-[#D06A4F] text-white"
                onClick={handleApprove}
                isLoading={status === 'processing' || isConnecting}
              >
                {isConnected ? (
                  <>
                    <Link2 className="w-4 h-4 mr-1.5" />
                    Connect
                  </>
                ) : (
                  'Sign In to Connect'
                )}
              </Button>
            </div>

            {/* Keyboard hints */}
            {isConnected && status === 'waiting' && (
              <div className="px-5 pb-4 flex items-center justify-center gap-4 text-[10px] text-[#B5B0AA]">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-[#F5F2ED] rounded text-[9px] font-mono text-[#9B9590]">
                    Enter
                  </kbd>
                  <span>connect</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-[#F5F2ED] rounded text-[9px] font-mono text-[#9B9590]">
                    Esc
                  </kbd>
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
