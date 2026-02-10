import { type ReactElement, useState, useEffect, useCallback, useRef } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useSignMessage, useWalletClient } from 'wagmi';
import { type Address } from 'viem';
import { Actions } from 'viem/tempo';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  Clock,
  Copy,
  Check,
  Fingerprint,
  Plus,
  Globe,
  ArrowRight,
  ArrowRightLeft,
  Droplet,
  FileText,
  AlertCircle,
  LinkIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CreateWalletModal } from '@/components/CreateWalletModal';
import { WalletSelectModal } from '@/components/WalletSelectModal';
import { useTempo } from '@/hooks/useTempo';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { DEFAULT_FEE_TOKEN_ADDRESS, TIMING } from '@/lib/constants';
import {
  parseMessage,
  sendResponse,
  handleSignMessageRequest,
  handleSendTransactionRequest,
  createSignMessageResponse,
  WalletConnectErrorCode,
  getErrorCode,
  createErrorResponse,
} from '@/lib/wallet-connect';
import { isAppConnected, hasPermission, saveConnectedApp } from '@/lib/connected-apps';
import { addActivity } from '@/lib/activity';
import type {
  SignMessageRequest,
  SendTransactionRequest,
  PendingRequest,
  ActivityType,
} from '@/types';
import { formatAddress, formatAmount, copyToClipboard } from '@/lib/utils';

export const Route = createFileRoute('/sign')({
  component: SignPage,
});

type RequestType =
  | 'sign_message'
  | 'send_payment'
  | 'send_scheduled_payment'
  | 'swap_tokens'
  | 'add_liquidity'
  | 'remove_liquidity'
  | 'send_transaction';

interface TransactionRequest {
  id: string;
  method: string;
  origin: string;
  timestamp: number;
  params: Record<string, unknown>;
}

// Helpers
function decodeMemo(hex: string | undefined): string | null {
  if (
    !hex ||
    hex === '0x' ||
    hex === '0x0000000000000000000000000000000000000000000000000000000000000000'
  )
    return null;
  try {
    const bytes = new Uint8Array(
      (hex.slice(2).match(/.{1,2}/g) || []).map(byte => parseInt(byte, 16))
    );
    return new TextDecoder().decode(bytes).replace(/\0+$/, '') || null;
  } catch {
    return null;
  }
}

function safeBigInt(value: string | number | bigint | undefined, fieldName: string): bigint {
  if (value === undefined || value === null || value === '')
    throw new Error(`${fieldName} is required`);
  try {
    return BigInt(value);
  } catch {
    throw new Error(`Invalid ${fieldName}`);
  }
}

function safeDisplayAmount(value: string | number | bigint | undefined): string {
  if (value === undefined || value === null || value === '') return '0';
  try {
    return formatAmount(BigInt(value));
  } catch {
    return String(value);
  }
}

function getUserFriendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('User rejected') || message.includes('user rejected'))
    return 'Transaction was cancelled';
  if (message.includes('insufficient funds') || message.includes('Insufficient'))
    return 'Insufficient balance';
  if (message.includes('nonce')) return 'Transaction conflict. Please try again.';
  if (message.includes('gas')) return 'Unable to estimate fees';
  if (message.includes('timeout') || message.includes('Timeout')) return 'Request timed out';
  if (message.includes('network') || message.includes('Network')) return 'Network error';
  if (message.includes('Not authorized') || message.includes('permission'))
    return 'Permission denied';
  return message.length > 80 ? message.substring(0, 80) + '...' : message;
}

const REQUEST_CONFIG: Record<
  RequestType,
  { icon: typeof ArrowRight; color: string; bg: string; title: string }
> = {
  sign_message: {
    icon: FileText,
    color: 'text-primary',
    bg: 'bg-primary/10',
    title: 'Sign Message',
  },
  send_payment: {
    icon: ArrowRight,
    color: 'text-primary',
    bg: 'bg-primary/10',
    title: 'Send Payment',
  },
  send_scheduled_payment: {
    icon: Clock,
    color: 'text-gray-600',
    bg: 'bg-gray-100',
    title: 'Scheduled Payment',
  },
  swap_tokens: {
    icon: ArrowRightLeft,
    color: 'text-primary',
    bg: 'bg-primary/10',
    title: 'Swap Tokens',
  },
  add_liquidity: {
    icon: Droplet,
    color: 'text-primary',
    bg: 'bg-primary/10',
    title: 'Add Liquidity',
  },
  remove_liquidity: {
    icon: Droplet,
    color: 'text-primary',
    bg: 'bg-primary/10',
    title: 'Remove Liquidity',
  },
  send_transaction: {
    icon: ArrowRight,
    color: 'text-gray-600',
    bg: 'bg-gray-100',
    title: 'Send Transaction',
  },
};

function SignPage(): ReactElement {
  const navigate = useNavigate();
  const { isConnected, isConnecting, address, signUp, signIn, connectInjected, hasInjectedWallet } =
    useTempo();
  const { signMessageAsync } = useSignMessage();
  const { data: walletClient } = useWalletClient();

  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [requestType, setRequestType] = useState<RequestType | null>(null);
  const [status, setStatus] = useState<
    'waiting' | 'processing' | 'success' | 'error' | 'rejected' | 'timeout' | 'not_connected'
  >('waiting');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [sourceWindow, setSourceWindow] = useState<Window | null>(null);
  const [sourceOrigin, setSourceOrigin] = useState<string | null>(null);
  const [disconnectedAppInfo, setDisconnectedAppInfo] = useState<{
    name: string;
    url: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showCreateWalletModal, setShowCreateWalletModal] = useState(false);
  const [showWalletSelectModal, setShowWalletSelectModal] = useState(false);
  const [_pendingAction, setPendingAction] = useState<'sign' | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  const shouldExecuteAfterAuth = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleCopy = async (value: string, field: string): Promise<void> => {
    if (await copyToClipboard(value)) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  // Listen for requests
  useEffect(() => {
    const validMethods = [
      'sign_message',
      'send_payment',
      'send_scheduled_payment',
      'swap_tokens',
      'add_liquidity',
      'remove_liquidity',
      'send_transaction',
    ];

    const handleMessage = (event: MessageEvent): void => {
      const parsed = parseMessage(event);
      if (!parsed) return;

      const { request, origin } = parsed;
      if (!validMethods.includes(request.method)) return;

      console.log('[Sign] Received request:', request.method, 'from:', origin);

      if (!isAppConnected(origin)) {
        // Store the request and app info for processing after reconnection
        const appName = new URL(origin).hostname;
        setDisconnectedAppInfo({ name: appName, url: origin });
        // Store the pending request so we can process it after reconnection
        setPendingRequest({
          request,
          appInfo: { name: appName, url: origin },
          status: 'pending',
        });
        setRequestType(request.method as RequestType);
        setSourceWindow(event.source as Window);
        setSourceOrigin(origin);
        setStatus('not_connected');
        return;
      }

      setPendingRequest({
        request,
        appInfo: { name: new URL(origin).hostname, url: origin },
        status: 'pending',
      });
      setRequestType(request.method as RequestType);
      setSourceWindow(event.source as Window);
      setSourceOrigin(origin);
      setStatus('waiting');
      setError(null);
      setTxHash(null);
    };

    window.addEventListener('message', handleMessage);
    if (window.opener)
      window.opener.postMessage({ type: 'TEMPO_WALLET_READY', version: '1.0.0' }, '*');

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const executeTransaction = useCallback(async () => {
    if (!pendingRequest || !sourceOrigin || !walletClient || !address) {
      setError('Wallet not ready');
      setStatus('error');
      return;
    }

    setStatus('processing');
    setError(null);

    try {
      const request = pendingRequest.request as TransactionRequest;
      let hash: `0x${string}` | undefined;

      if (request.method !== 'sign_message' && !hasPermission(sourceOrigin, 'send')) {
        throw new Error('Permission denied');
      }

      switch (request.method) {
        case 'sign_message': {
          const signReq = request as unknown as SignMessageRequest;
          const { authorized, error: authError } = handleSignMessageRequest(signReq, sourceOrigin);
          if (!authorized) throw new Error(authError || 'Not authorized');
          if (!signReq.params?.message) throw new Error('Message required');

          const signature = await signMessageAsync({ message: signReq.params.message });
          const response = createSignMessageResponse(signReq, signature);
          if (sourceWindow) sendResponse(sourceOrigin, response, sourceWindow);
          break;
        }

        case 'send_payment': {
          const params = request.params as {
            to: Address;
            amount: string;
            token?: Address;
            feeToken?: Address;
            memo?: `0x${string}`;
          };
          if (!params.to) throw new Error('Recipient required');

          hash = await Actions.token.transfer(walletClient, {
            token: params.token || DEFAULT_FEE_TOKEN_ADDRESS,
            to: params.to,
            amount: safeBigInt(params.amount, 'Amount'),
            memo: params.memo,
            feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
          });
          break;
        }

        case 'send_scheduled_payment': {
          const params = request.params as {
            to: Address;
            amount: string;
            token?: Address;
            feeToken?: Address;
            memo?: `0x${string}`;
            scheduledFor: number;
          };
          if (!params.to || !params.scheduledFor) throw new Error('Missing required fields');

          hash = await Actions.token.transfer(walletClient, {
            token: params.token || DEFAULT_FEE_TOKEN_ADDRESS,
            to: params.to,
            amount: safeBigInt(params.amount, 'Amount'),
            memo: params.memo,
            feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
            validAfter: params.scheduledFor,
          });
          break;
        }

        case 'swap_tokens': {
          const params = request.params as {
            tokenIn: Address;
            tokenOut: Address;
            amountIn: string;
            minAmountOut: string;
            feeToken?: Address;
          };
          if (!params.tokenIn || !params.tokenOut) throw new Error('Token addresses required');

          hash = await Actions.dex.sell(walletClient, {
            tokenIn: params.tokenIn,
            tokenOut: params.tokenOut,
            amountIn: safeBigInt(params.amountIn, 'Amount in'),
            minAmountOut: safeBigInt(params.minAmountOut, 'Min amount out'),
            feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
          });
          break;
        }

        case 'add_liquidity': {
          const params = request.params as {
            userToken: Address;
            validatorToken: Address;
            validatorTokenAmount: string;
            feeToken?: Address;
          };
          if (!params.userToken || !params.validatorToken)
            throw new Error('Token addresses required');

          hash = await Actions.amm.mint(walletClient, {
            userTokenAddress: params.userToken,
            validatorTokenAddress: params.validatorToken,
            validatorTokenAmount: safeBigInt(params.validatorTokenAmount, 'Amount'),
            to: address,
            feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
          });
          break;
        }

        case 'remove_liquidity': {
          const params = request.params as {
            userToken: Address;
            validatorToken: Address;
            liquidity: string;
            feeToken?: Address;
          };
          if (!params.userToken || !params.validatorToken)
            throw new Error('Token addresses required');

          hash = await Actions.amm.burn(walletClient, {
            userToken: params.userToken,
            validatorToken: params.validatorToken,
            liquidity: safeBigInt(params.liquidity, 'Liquidity'),
            to: address,
            feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
          });
          break;
        }

        case 'send_transaction': {
          const txReq = request as unknown as SendTransactionRequest;
          const { authorized, error: authError } = handleSendTransactionRequest(
            txReq,
            sourceOrigin
          );
          if (!authorized) throw new Error(authError || 'Not authorized');

          const params = txReq.params?.transaction;
          if (!params?.to) throw new Error('Recipient required');

          hash = await walletClient.sendTransaction({
            to: params.to,
            value: params.value ? BigInt(params.value) : undefined,
            data: params.data,
          });
          break;
        }

        default:
          throw new Error(`Unsupported: ${request.method}`);
      }

      if (hash && request.method !== 'sign_message') {
        setTxHash(hash);
        if (sourceWindow)
          sendResponse(
            sourceOrigin,
            { id: request.id, success: true, result: { hash } },
            sourceWindow
          );
      }

      addActivity({
        type: request.method as ActivityType,
        status: 'success',
        appName: pendingRequest.appInfo.name,
        appUrl: pendingRequest.appInfo.url,
        txHash: hash,
        details: request.params as Record<string, unknown>,
      });

      setStatus('success');
      setTimeout(() => window.close(), 3000);
    } catch (err) {
      console.error('[Sign] Failed:', err);
      const friendlyError = getUserFriendlyError(err);
      setError(friendlyError);
      setStatus('error');

      addActivity({
        type: (pendingRequest?.request.method || 'send_transaction') as ActivityType,
        status: 'failed',
        appName: pendingRequest?.appInfo.name || '',
        appUrl: pendingRequest?.appInfo.url || '',
        details: { error: friendlyError },
      });

      if (pendingRequest && sourceWindow && sourceOrigin) {
        const errorCode = getErrorCode(friendlyError);
        sendResponse(
          sourceOrigin,
          createErrorResponse(pendingRequest.request.id, friendlyError, errorCode),
          sourceWindow
        );
      }
    }
  }, [pendingRequest, sourceOrigin, sourceWindow, signMessageAsync, walletClient, address]);

  useEffect(() => {
    // Skip if in not_connected state - that has its own reconnection handler
    if (status === 'not_connected') return;

    if (
      shouldExecuteAfterAuth.current &&
      isConnected &&
      address &&
      walletClient &&
      pendingRequest &&
      !isConnecting
    ) {
      shouldExecuteAfterAuth.current = false;
      setPendingAction(null);
      executeTransaction();
    }
  }, [
    status,
    isConnected,
    address,
    walletClient,
    pendingRequest,
    isConnecting,
    executeTransaction,
  ]);

  useEffect(() => {
    if (!pendingRequest || status !== 'waiting') {
      if (timerRef.current) clearInterval(timerRef.current);
      setTimeRemaining(null);
      return;
    }

    const timeoutMs = TIMING.SIGNING_TIMEOUT_MS;
    const endTime = Date.now() + timeoutMs;
    setTimeRemaining(Math.ceil(timeoutMs / 1000));

    timerRef.current = setInterval(() => {
      const remaining = Math.ceil((endTime - Date.now()) / 1000);
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeRemaining(0);
        setStatus('timeout');

        if (sourceWindow && sourceOrigin && pendingRequest) {
          sendResponse(
            sourceOrigin,
            createErrorResponse(
              pendingRequest.request.id,
              'Request timed out',
              WalletConnectErrorCode.REQUEST_TIMEOUT
            ),
            sourceWindow
          );
          addActivity({
            type: (pendingRequest.request.method || 'send_transaction') as ActivityType,
            status: 'timeout',
            appName: pendingRequest.appInfo.name,
            appUrl: pendingRequest.appInfo.url,
          });
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
    if (!pendingRequest || !sourceOrigin || !sourceWindow) return;

    sendResponse(
      sourceOrigin,
      createErrorResponse(
        pendingRequest.request.id,
        'User rejected the request',
        WalletConnectErrorCode.USER_REJECTED
      ),
      sourceWindow
    );
    addActivity({
      type: (pendingRequest.request.method || 'send_transaction') as ActivityType,
      status: 'rejected',
      appName: pendingRequest.appInfo.name,
      appUrl: pendingRequest.appInfo.url,
    });
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

      if (e.key === 'Enter' && isConnected && address && walletClient) {
        e.preventDefault();
        executeTransaction();
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
    walletClient,
    showCreateWalletModal,
    showWalletSelectModal,
    executeTransaction,
    handleReject,
  ]);

  const handleApprove = useCallback(() => {
    if (!pendingRequest || !sourceOrigin) return;
    if (isConnected && address && walletClient) {
      executeTransaction();
    } else {
      setShowWalletSelectModal(true);
    }
  }, [pendingRequest, sourceOrigin, isConnected, address, walletClient, executeTransaction]);

  const handleCreateWallet = async (walletName?: string): Promise<void> => {
    try {
      shouldExecuteAfterAuth.current = true;
      setPendingAction('sign');
      await signUp(walletName);
      setShowCreateWalletModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Cancelled');
      shouldExecuteAfterAuth.current = false;
      setPendingAction(null);
    }
  };

  const handlePasskeySignIn = async (): Promise<void> => {
    setShowWalletSelectModal(false);
    try {
      shouldExecuteAfterAuth.current = true;
      setPendingAction('sign');
      await signIn();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      toast.error(message.includes('publicKey not found') ? 'Passkey not found' : message);
      shouldExecuteAfterAuth.current = false;
      setPendingAction(null);
    }
  };

  const handleInjectedConnect = async (): Promise<void> => {
    setShowWalletSelectModal(false);
    try {
      shouldExecuteAfterAuth.current = true;
      setPendingAction('sign');
      await connectInjected();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed';
      toast.error(message.includes('rejected') ? 'Cancelled' : message);
      shouldExecuteAfterAuth.current = false;
      setPendingAction(null);
    }
  };

  // Handle reconnection from not_connected state
  const handleReconnect = useCallback(() => {
    if (!sourceOrigin || !disconnectedAppInfo) return;

    // If user is authenticated, reconnect the app and process the original request
    if (isConnected && address && walletClient) {
      // Save the app as connected
      saveConnectedApp({
        name: disconnectedAppInfo.name,
        url: sourceOrigin,
        connectedAt: Date.now(),
        lastUsedAt: Date.now(),
        permissions: ['connect', 'sign', 'send'],
      });

      // Clear the disconnected state
      setDisconnectedAppInfo(null);

      // Process the original request if we have one
      if (pendingRequest) {
        // Reset the auth flag to prevent double execution from the other useEffect
        shouldExecuteAfterAuth.current = false;
        setPendingAction(null);
        setStatus('waiting');
        toast.success('App reconnected! Processing your request...');
        // Give UI time to update, then execute the transaction
        setTimeout(() => executeTransaction(), 300);
      } else {
        // No pending request, just close
        if (sourceWindow) {
          sendResponse(
            sourceOrigin,
            {
              id: 'reconnect',
              success: true,
              result: { reconnected: true, address },
            },
            sourceWindow
          );
        }
        toast.success('App reconnected!');
        setTimeout(() => window.close(), 1500);
      }
    } else {
      // User needs to sign in first
      // Don't set shouldExecuteAfterAuth.current - the useEffect watching for
      // not_connected + auth will handle reconnection and execution
      setShowWalletSelectModal(true);
    }
  }, [
    sourceOrigin,
    disconnectedAppInfo,
    isConnected,
    address,
    walletClient,
    sourceWindow,
    pendingRequest,
    executeTransaction,
  ]);

  // Handle reconnection after authentication
  useEffect(() => {
    if (
      status === 'not_connected' &&
      isConnected &&
      address &&
      walletClient &&
      disconnectedAppInfo &&
      sourceOrigin &&
      !isConnecting
    ) {
      // User just authenticated while in not_connected state - auto reconnect
      handleReconnect();
    }
  }, [
    status,
    isConnected,
    address,
    walletClient,
    disconnectedAppInfo,
    sourceOrigin,
    isConnecting,
    handleReconnect,
  ]);

  const handleCancelNotConnected = (): void => {
    if (sourceWindow && sourceOrigin) {
      const requestId = pendingRequest?.request.id || 'cancelled';
      const response = createErrorResponse(
        requestId,
        'User cancelled - app not connected',
        WalletConnectErrorCode.NOT_CONNECTED
      );
      sendResponse(sourceOrigin, response, sourceWindow);
    }
    window.close();
  };

  // Status screens - check not_connected FIRST (before pendingRequest check)
  if (status === 'not_connected') {
    return (
      <>
        <div className="min-h-screen bg-[#FDFBF8] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-[360px]"
          >
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="p-6 text-center border-b border-gray-100">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <LinkIcon className="w-7 h-7 text-gray-500" />
                </div>
                <h1 className="text-[17px] font-semibold text-gray-900 mb-2">App Not Connected</h1>
                <p className="text-[13px] text-gray-500">
                  This app&apos;s connection was revoked or has expired.
                </p>
              </div>

              {/* App Info */}
              {disconnectedAppInfo && (
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                      <Globe className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium text-gray-900 truncate">
                        {disconnectedAppInfo.name}
                      </p>
                      <p className="text-[12px] text-gray-500 truncate">
                        {disconnectedAppInfo.url}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Auth Status & Actions */}
              <div className="p-6">
                {isConnected && address ? (
                  <>
                    <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20 mb-4">
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
                    <p className="text-[13px] text-gray-600 text-center mb-4">
                      Click below to reconnect this app to your wallet.
                    </p>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1 h-10"
                        onClick={handleCancelNotConnected}
                      >
                        Cancel
                      </Button>
                      <Button className="flex-1 h-10" onClick={handleReconnect}>
                        <LinkIcon className="w-4 h-4 mr-2" />
                        Reconnect App
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[13px] text-gray-600 text-center mb-4">
                      Sign in to your wallet to reconnect this app.
                    </p>
                    <div className="flex gap-2 mb-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-10"
                        onClick={() => setShowWalletSelectModal(true)}
                        disabled={isConnecting}
                      >
                        <Fingerprint className="w-4 h-4 mr-1.5" />
                        Sign In
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 h-10"
                        onClick={() => setShowCreateWalletModal(true)}
                        disabled={isConnecting}
                      >
                        <Plus className="w-4 h-4 mr-1.5" />
                        Create Wallet
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-gray-500"
                      onClick={handleCancelNotConnected}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Modals must be rendered here too */}
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

  if (!pendingRequest) {
    return (
      <div className="min-h-screen bg-[#FDFBF8] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[360px]"
        >
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
            <h1 className="text-[15px] font-semibold text-gray-900 mb-1">Waiting for Request</h1>
            <p className="text-[13px] text-gray-500 mb-5">
              Waiting for an app to request signing...
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
      <div className="min-h-screen bg-[#FDFBF8] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-[360px]"
        >
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-[15px] font-semibold text-gray-900 mb-1">
              {requestType === 'sign_message' ? 'Message Signed' : 'Transaction Sent'}
            </h1>
            <p className="text-[13px] text-gray-500 mb-4">
              {requestType === 'sign_message' ? 'Signature complete' : 'Transaction submitted'}
            </p>
            {txHash && (
              <a
                href={getExplorerTxUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] text-primary hover:text-primary/80"
              >
                View on Explorer <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="min-h-screen bg-[#FDFBF8] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-[360px]"
        >
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-6 h-6 text-gray-500" />
            </div>
            <h1 className="text-[15px] font-semibold text-gray-900 mb-1">Request Rejected</h1>
            <p className="text-[13px] text-gray-500">You declined the request</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (status === 'timeout') {
    return (
      <div className="min-h-screen bg-[#FDFBF8] flex items-center justify-center p-4">
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
            <p className="text-[13px] text-gray-500">The request has expired</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#FDFBF8] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-[360px]"
        >
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-6 h-6 text-gray-500" />
            </div>
            <h1 className="text-[15px] font-semibold text-gray-900 mb-1">Request Failed</h1>
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

  // Main request UI
  const request = pendingRequest.request as TransactionRequest;
  const params = request.params || {};
  const configKey: RequestType = requestType || 'send_transaction';
  const config = REQUEST_CONFIG[configKey];
  const Icon = config.icon;
  const memo = decodeMemo(params.memo as string | undefined);

  return (
    <>
      <div className="min-h-screen bg-[#FDFBF8] flex items-center justify-center p-4">
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

              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center`}
                >
                  <Icon className={`w-5 h-5 ${config.color}`} />
                </div>
                <div>
                  <h1 className="text-[15px] font-semibold text-gray-900">{config.title}</h1>
                  <p className="text-[12px] text-gray-500">Review and confirm</p>
                </div>
              </div>
            </div>

            {/* Request Details */}
            <div className="p-5 border-b border-gray-100">
              {requestType === 'sign_message' ? (
                <div>
                  <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Message
                  </p>
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 max-h-32 overflow-auto">
                    <p className="text-[13px] font-mono text-gray-700 break-all whitespace-pre-wrap">
                      {(params as { message?: string }).message || '(empty)'}
                    </p>
                  </div>
                </div>
              ) : requestType === 'send_payment' || requestType === 'send_scheduled_payment' ? (
                <div className="space-y-4">
                  {/* Amount */}
                  <div className={`p-4 rounded-lg ${config.bg} text-center`}>
                    <p className={`text-[11px] font-medium ${config.color} mb-1`}>Amount</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {safeDisplayAmount(params.amount as string)}
                    </p>
                    <p className={`text-[12px] ${config.color}`}>USD</p>
                  </div>

                  {/* Scheduled time */}
                  {requestType === 'send_scheduled_payment' &&
                    params.scheduledFor !== null &&
                    params.scheduledFor !== undefined && (
                      <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-lg border border-gray-200">
                        <Clock className="w-4 h-4 text-gray-600" />
                        <div>
                          <p className="text-[11px] text-gray-500">Scheduled for</p>
                          <p className="text-[13px] font-medium text-gray-900">
                            {new Date((params.scheduledFor as number) * 1000).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}

                  {/* Details */}
                  <div className="space-y-2">
                    <DetailRow
                      label="To"
                      value={formatAddress(params.to as string, 8)}
                      copyValue={params.to as string}
                      onCopy={handleCopy}
                      copiedField={copiedField}
                      fieldKey="to"
                    />
                    {memo && <DetailRow label="Memo" value={memo} />}
                  </div>
                </div>
              ) : requestType === 'swap_tokens' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-[11px] text-gray-500">You pay</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {safeDisplayAmount(params.amountIn as string)}
                      </p>
                    </div>
                    <ArrowRightLeft className="w-5 h-5 text-gray-400" />
                    <div className="text-right">
                      <p className="text-[11px] text-gray-500">You receive (min)</p>
                      <p className="text-lg font-semibold text-primary">
                        {safeDisplayAmount(params.minAmountOut as string)}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <DetailRow
                      label="Token In"
                      value={formatAddress(params.tokenIn as string, 6)}
                      copyValue={params.tokenIn as string}
                      onCopy={handleCopy}
                      copiedField={copiedField}
                      fieldKey="tokenIn"
                    />
                    <DetailRow
                      label="Token Out"
                      value={formatAddress(params.tokenOut as string, 6)}
                      copyValue={params.tokenOut as string}
                      onCopy={handleCopy}
                      copiedField={copiedField}
                      fieldKey="tokenOut"
                    />
                  </div>
                </div>
              ) : requestType === 'add_liquidity' || requestType === 'remove_liquidity' ? (
                <div className="space-y-4">
                  <div className={`p-4 rounded-lg ${config.bg} text-center`}>
                    <p className={`text-[11px] font-medium ${config.color} mb-1`}>
                      {requestType === 'add_liquidity' ? 'Amount' : 'LP Tokens'}
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {safeDisplayAmount(
                        (requestType === 'add_liquidity'
                          ? params.validatorTokenAmount
                          : params.liquidity) as string
                      )}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <DetailRow
                      label="User Token"
                      value={formatAddress(params.userToken as string, 6)}
                      copyValue={params.userToken as string}
                      onCopy={handleCopy}
                      copiedField={copiedField}
                      fieldKey="userToken"
                    />
                    <DetailRow
                      label="Validator Token"
                      value={formatAddress(params.validatorToken as string, 6)}
                      copyValue={params.validatorToken as string}
                      onCopy={handleCopy}
                      copiedField={copiedField}
                      fieldKey="validatorToken"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Transaction Data
                  </p>
                  <pre className="text-[11px] font-mono bg-gray-50 rounded-lg p-3 overflow-auto max-h-32 border border-gray-200">
                    {JSON.stringify(params, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Wallet Status */}
            <div className="p-5 border-b border-gray-100">
              {isConnected && address ? (
                <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-gray-700">Signing with</p>
                    <p className="text-[12px] font-mono text-primary">
                      {formatAddress(address, 6)}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-[13px] font-medium text-gray-700 mb-3">Sign in to continue</p>
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

            {/* Warning */}
            <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                <p className="text-[12px] text-gray-600">
                  {requestType === 'sign_message'
                    ? 'Only sign messages from trusted apps.'
                    : 'Review carefully. Transactions cannot be reversed.'}
                </p>
              </div>
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
                {isConnected
                  ? requestType === 'sign_message'
                    ? 'Sign'
                    : 'Confirm'
                  : 'Sign In to Continue'}
              </Button>
            </div>

            {/* Keyboard hints */}
            {isConnected && status === 'waiting' && (
              <div className="px-5 pb-4 flex items-center justify-center gap-4 text-[11px] text-gray-400">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono">
                    Enter
                  </kbd>
                  <span>{requestType === 'sign_message' ? 'sign' : 'confirm'}</span>
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

// Detail row component
function DetailRow({
  label,
  value,
  copyValue,
  onCopy,
  copiedField,
  fieldKey,
}: {
  label: string;
  value: string;
  copyValue?: string;
  onCopy?: (value: string, field: string) => void;
  copiedField?: string | null;
  fieldKey?: string;
}): ReactElement {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-[12px] text-gray-500">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-[13px] text-gray-900 font-mono">{value}</span>
        {copyValue && onCopy && fieldKey && (
          <button
            onClick={() => onCopy(copyValue, fieldKey)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            {copiedField === fieldKey ? (
              <Check className="w-3 h-3 text-primary" />
            ) : (
              <Copy className="w-3 h-3 text-gray-400" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
