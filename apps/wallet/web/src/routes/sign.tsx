import { type ReactElement, useState, useEffect, useCallback } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useSignMessage, useWalletClient } from 'wagmi';
import { type Address } from 'viem';
import { Actions } from 'viem/tempo';
import { motion } from 'framer-motion';
import {
  FileSignature,
  Send,
  ArrowRightLeft,
  Droplets,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Clock,
  Copy,
  Check,
  MessageSquare,
  Coins,
  Wallet,
  Fingerprint,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CreateWalletModal } from '@/components/CreateWalletModal';
import { WalletSelectModal } from '@/components/WalletSelectModal';
import { useTempo } from '@/hooks/useTempo';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { DEFAULT_FEE_TOKEN_ADDRESS } from '@/lib/constants';
import {
  parseMessage,
  sendResponse,
  handleSignMessageRequest,
  createSignMessageResponse,
} from '@/lib/wallet-connect';
import { isAppConnected } from '@/lib/connected-apps';
import type { SignMessageRequest, PendingRequest } from '@/types';
import { formatAddress, formatAmount, copyToClipboard } from '@/lib/utils';

/**
 * Decode memo from hex bytes to string
 */
function decodeMemo(hex: string | undefined): string | null {
  if (
    !hex ||
    hex === '0x' ||
    hex === '0x0000000000000000000000000000000000000000000000000000000000000000'
  ) {
    return null;
  }
  try {
    const bytes = new Uint8Array(
      (hex.slice(2).match(/.{1,2}/g) || []).map(byte => parseInt(byte, 16))
    );
    return new TextDecoder().decode(bytes).replace(/\0+$/, '') || null;
  } catch {
    return null;
  }
}

/**
 * Detail row component for consistent styling
 */
function DetailRow({
  label,
  value,
  mono = false,
  copyable = false,
  onCopy,
  copied = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`text-sm text-right break-all ${mono ? 'font-mono text-xs' : ''}`}>
          {value}
        </span>
        {copyable && onCopy && (
          <button
            onClick={onCopy}
            className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
          >
            {copied ? (
              <Check className="w-3 h-3 text-green-600" />
            ) : (
              <Copy className="w-3 h-3 text-muted-foreground" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

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

function SignPage(): ReactElement {
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
  const { signMessageAsync } = useSignMessage();
  const { data: walletClient } = useWalletClient();

  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [requestType, setRequestType] = useState<RequestType | null>(null);
  const [status, setStatus] = useState<'waiting' | 'processing' | 'success' | 'error'>('waiting');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [sourceWindow, setSourceWindow] = useState<Window | null>(null);
  const [sourceOrigin, setSourceOrigin] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showCreateWalletModal, setShowCreateWalletModal] = useState(false);
  const [showWalletSelectModal, setShowWalletSelectModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'sign' | null>(null);

  const handleCopy = async (value: string, field: string) => {
    const success = await copyToClipboard(value);
    if (success) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  // Listen for incoming signing requests
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

    const handleMessage = (event: MessageEvent) => {
      const parsed = parseMessage(event);
      if (!parsed) return;

      const { request, origin } = parsed;

      // Only handle signing/transaction requests on this page
      if (!validMethods.includes(request.method)) {
        return;
      }

      console.log('[Sign] Received request:', request.method, 'from:', origin);

      // Check if app is connected
      if (!isAppConnected(origin)) {
        const response = {
          id: request.id,
          success: false,
          error: 'App not connected. Please connect first.',
        };
        if (event.source) {
          sendResponse(origin, response, event.source as Window);
        }
        return;
      }

      // Create pending request
      const pending: PendingRequest = {
        request,
        appInfo: {
          name: new URL(origin).hostname,
          url: origin,
        },
        status: 'pending',
      };

      setPendingRequest(pending);
      setRequestType(request.method as RequestType);
      setSourceWindow(event.source as Window);
      setSourceOrigin(origin);
    };

    window.addEventListener('message', handleMessage);

    // Notify opener that wallet is ready
    if (window.opener) {
      window.opener.postMessage({ type: 'TEMPO_WALLET_READY', version: '1.0.0' }, '*');
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // When user completes authentication, proceed with signing
  useEffect(() => {
    if (pendingAction === 'sign' && isConnected && address && pendingRequest && !isConnecting) {
      setPendingAction(null);
      // Small delay to ensure walletClient is ready
      setTimeout(() => {
        executeTransaction();
      }, 100);
    }
  }, [isConnected, address, pendingAction, pendingRequest, isConnecting]);

  const executeTransaction = useCallback(async () => {
    if (!pendingRequest || !sourceOrigin) return;

    setStatus('processing');

    try {
      if (!walletClient || !address) {
        throw new Error('Wallet not available');
      }

      const request = pendingRequest.request as TransactionRequest;
      let hash: `0x${string}` | undefined;

      switch (request.method) {
        case 'sign_message': {
          const signReq = request as unknown as SignMessageRequest;
          const { authorized, error: authError } = handleSignMessageRequest(signReq, sourceOrigin);
          if (!authorized) throw new Error(authError || 'Not authorized');

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

          hash = await Actions.token.transfer(walletClient, {
            token: params.token || DEFAULT_FEE_TOKEN_ADDRESS,
            to: params.to,
            amount: BigInt(params.amount),
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

          hash = await Actions.token.transfer(walletClient, {
            token: params.token || DEFAULT_FEE_TOKEN_ADDRESS,
            to: params.to,
            amount: BigInt(params.amount),
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

          hash = await Actions.dex.sell(walletClient, {
            tokenIn: params.tokenIn,
            tokenOut: params.tokenOut,
            amountIn: BigInt(params.amountIn),
            minAmountOut: BigInt(params.minAmountOut),
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

          hash = await Actions.amm.mint(walletClient, {
            userTokenAddress: params.userToken,
            validatorTokenAddress: params.validatorToken,
            validatorTokenAmount: BigInt(params.validatorTokenAmount),
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

          hash = await Actions.amm.burn(walletClient, {
            userToken: params.userToken,
            validatorToken: params.validatorToken,
            liquidity: BigInt(params.liquidity),
            to: address,
            feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
          });
          break;
        }

        default:
          throw new Error(`Unknown request type: ${request.method}`);
      }

      // Send success response for transaction requests
      if (hash && request.method !== 'sign_message') {
        setTxHash(hash);
        const response = {
          id: request.id,
          success: true,
          result: { hash },
        };
        if (sourceWindow) sendResponse(sourceOrigin, response, sourceWindow);
      }

      setStatus('success');

      // Close window after delay
      setTimeout(() => {
        window.close();
      }, 2000);
    } catch (err) {
      console.error('[Sign] Failed:', err);
      setError(err instanceof Error ? err.message : 'Operation failed');
      setStatus('error');

      // Send error response
      if (pendingRequest && sourceWindow && sourceOrigin) {
        const errorResponse = {
          id: pendingRequest.request.id,
          success: false,
          error: err instanceof Error ? err.message : 'Operation failed',
        };
        sendResponse(sourceOrigin, errorResponse, sourceWindow);
      }
    }
  }, [pendingRequest, sourceOrigin, sourceWindow, signMessageAsync, walletClient, address]);

  const handleApprove = useCallback(() => {
    if (!pendingRequest || !sourceOrigin) return;

    if (isConnected && address && walletClient) {
      // Already connected, execute transaction
      executeTransaction();
    } else {
      // Need to authenticate first - show wallet select modal
      setShowWalletSelectModal(true);
    }
  }, [pendingRequest, sourceOrigin, isConnected, address, walletClient, executeTransaction]);

  const handleCreateWallet = async (walletName?: string): Promise<void> => {
    try {
      setPendingAction('sign');
      await signUp(walletName);
      setShowCreateWalletModal(false);
    } catch (err) {
      console.error('Wallet creation error:', err);
      toast.error(err instanceof Error ? err.message : 'Wallet creation cancelled');
      setPendingAction(null);
    }
  };

  const handlePasskeySignIn = async (): Promise<void> => {
    setShowWalletSelectModal(false);
    try {
      setPendingAction('sign');
      await signIn();
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
      setPendingAction('sign');
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
      setPendingAction(null);
    }
  };

  const handleReject = useCallback(() => {
    if (!pendingRequest || !sourceOrigin || !sourceWindow) return;

    const response = {
      id: pendingRequest.request.id,
      success: false,
      error: 'User rejected the request',
    };

    sendResponse(sourceOrigin, response, sourceWindow);

    setTimeout(() => {
      window.close();
    }, 500);
  }, [pendingRequest, sourceOrigin, sourceWindow]);

  const handleGoToWallet = () => {
    navigate({ to: '/' });
  };

  // No pending request - show waiting state
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
            <h1 className="text-xl font-semibold mb-2">Waiting for Request</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Waiting for an app to request signing...
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
            <h1 className="text-xl font-semibold mb-2">
              {requestType === 'sign_message' ? 'Message Signed' : 'Transaction Sent'}
            </h1>
            <p className="text-sm text-muted-foreground mb-4">
              {requestType === 'sign_message'
                ? 'Message was signed successfully'
                : 'Transaction was sent successfully'}
            </p>
            {txHash && (
              <a
                href={getExplorerTxUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View on Explorer
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
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
            <h1 className="text-xl font-semibold mb-2">Request Failed</h1>
            <p className="text-sm text-muted-foreground">{error || 'Something went wrong'}</p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Get request details for UI
  const request = pendingRequest.request as TransactionRequest;
  const params = request.params || {};

  // Render based on request type
  const renderRequestUI = () => {
    const memo = decodeMemo(params.memo as string | undefined);
    const feeToken = params.feeToken as string | undefined;
    const showFeeToken = feeToken && feeToken !== DEFAULT_FEE_TOKEN_ADDRESS;

    switch (requestType) {
      case 'sign_message':
        return (
          <>
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
              <FileSignature className="w-7 h-7 text-blue-500" />
            </div>
            <h1 className="text-xl font-semibold text-center mb-1">Sign Message</h1>
            <p className="text-sm text-muted-foreground text-center mb-4">
              {pendingRequest.appInfo.name} requests your signature
            </p>
            <div className="bg-muted/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Message
                </span>
              </div>
              <div className="bg-white rounded-lg p-3 border border-border/50 max-h-40 overflow-auto">
                <p className="text-sm font-mono break-all whitespace-pre-wrap">
                  {(params as { message?: string }).message}
                </p>
              </div>
            </div>
          </>
        );

      case 'send_payment': {
        const toAddress = params.to as string;
        const token = params.token as string | undefined;
        return (
          <>
            <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <Send className="w-7 h-7 text-green-500" />
            </div>
            <h1 className="text-xl font-semibold text-center mb-1">Send Payment</h1>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Review the transaction details below
            </p>

            {/* Amount - Prominent */}
            <div className="bg-green-50 rounded-xl p-4 mb-4 text-center">
              <p className="text-xs text-green-600 mb-1">Amount</p>
              <p className="text-3xl font-bold text-green-700">
                {formatAmount(BigInt(params.amount as string))}
              </p>
              <p className="text-sm text-green-600">USD</p>
            </div>

            {/* Details */}
            <div className="bg-muted/50 rounded-xl p-4 space-y-1">
              <DetailRow
                label="Recipient"
                value={toAddress}
                mono
                copyable
                onCopy={() => handleCopy(toAddress, 'to')}
                copied={copiedField === 'to'}
              />
              {token && token !== DEFAULT_FEE_TOKEN_ADDRESS && (
                <DetailRow
                  label="Token"
                  value={formatAddress(token, 6)}
                  mono
                  copyable
                  onCopy={() => handleCopy(token, 'token')}
                  copied={copiedField === 'token'}
                />
              )}
              {memo && <DetailRow label="Memo" value={memo} />}
              {showFeeToken && (
                <DetailRow label="Fee Token" value={formatAddress(feeToken!, 6)} mono />
              )}
            </div>
          </>
        );
      }

      case 'send_scheduled_payment': {
        const scheduledFor = params.scheduledFor as number;
        const scheduledDate = new Date(scheduledFor * 1000);
        const toAddress = params.to as string;
        return (
          <>
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-7 h-7 text-amber-500" />
            </div>
            <h1 className="text-xl font-semibold text-center mb-1">Scheduled Payment</h1>
            <p className="text-sm text-muted-foreground text-center mb-4">
              This payment will execute at the scheduled time
            </p>

            {/* Amount */}
            <div className="bg-amber-50 rounded-xl p-4 mb-4 text-center">
              <p className="text-xs text-amber-600 mb-1">Amount</p>
              <p className="text-3xl font-bold text-amber-700">
                {formatAmount(BigInt(params.amount as string))}
              </p>
              <p className="text-sm text-amber-600">USD</p>
            </div>

            {/* Schedule Info */}
            <div className="bg-amber-50/50 rounded-xl p-3 mb-4 flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-600" />
              <div>
                <p className="text-xs text-amber-600">Scheduled For</p>
                <p className="text-sm font-semibold text-amber-800">
                  {scheduledDate.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Details */}
            <div className="bg-muted/50 rounded-xl p-4 space-y-1">
              <DetailRow
                label="Recipient"
                value={toAddress}
                mono
                copyable
                onCopy={() => handleCopy(toAddress, 'to')}
                copied={copiedField === 'to'}
              />
              {memo && <DetailRow label="Memo" value={memo} />}
              {showFeeToken && (
                <DetailRow label="Fee Token" value={formatAddress(feeToken!, 6)} mono />
              )}
            </div>
          </>
        );
      }

      case 'swap_tokens': {
        const tokenIn = params.tokenIn as string;
        const tokenOut = params.tokenOut as string;
        return (
          <>
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
              <ArrowRightLeft className="w-7 h-7 text-purple-500" />
            </div>
            <h1 className="text-xl font-semibold text-center mb-1">Swap Tokens</h1>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Exchange tokens at the current rate
            </p>

            {/* Swap Visual */}
            <div className="bg-muted/50 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">You Pay</p>
                  <p className="text-2xl font-bold">
                    {formatAmount(BigInt(params.amountIn as string))}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <ArrowRightLeft className="w-5 h-5 text-purple-500" />
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground mb-1">You Receive (min)</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatAmount(BigInt(params.minAmountOut as string))}
                  </p>
                </div>
              </div>
            </div>

            {/* Token Addresses */}
            <div className="bg-muted/50 rounded-xl p-4 space-y-1">
              <DetailRow
                label="Token In"
                value={tokenIn}
                mono
                copyable
                onCopy={() => handleCopy(tokenIn, 'tokenIn')}
                copied={copiedField === 'tokenIn'}
              />
              <DetailRow
                label="Token Out"
                value={tokenOut}
                mono
                copyable
                onCopy={() => handleCopy(tokenOut, 'tokenOut')}
                copied={copiedField === 'tokenOut'}
              />
              {showFeeToken && (
                <DetailRow label="Fee Token" value={formatAddress(feeToken!, 6)} mono />
              )}
            </div>
          </>
        );
      }

      case 'add_liquidity': {
        const userToken = params.userToken as string;
        const validatorToken = params.validatorToken as string;
        return (
          <>
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center mx-auto mb-4">
              <Droplets className="w-7 h-7 text-cyan-500" />
            </div>
            <h1 className="text-xl font-semibold text-center mb-1">Add Liquidity</h1>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Provide liquidity to earn trading fees
            </p>

            {/* Amount */}
            <div className="bg-cyan-50 rounded-xl p-4 mb-4 text-center">
              <p className="text-xs text-cyan-600 mb-1">Validator Token Amount</p>
              <p className="text-3xl font-bold text-cyan-700">
                {formatAmount(BigInt(params.validatorTokenAmount as string))}
              </p>
            </div>

            {/* Pool Tokens */}
            <div className="bg-muted/50 rounded-xl p-4 space-y-1">
              <DetailRow
                label="User Token"
                value={userToken}
                mono
                copyable
                onCopy={() => handleCopy(userToken, 'userToken')}
                copied={copiedField === 'userToken'}
              />
              <DetailRow
                label="Validator Token"
                value={validatorToken}
                mono
                copyable
                onCopy={() => handleCopy(validatorToken, 'validatorToken')}
                copied={copiedField === 'validatorToken'}
              />
              {showFeeToken && (
                <DetailRow label="Fee Token" value={formatAddress(feeToken!, 6)} mono />
              )}
            </div>
          </>
        );
      }

      case 'remove_liquidity': {
        const userToken = params.userToken as string;
        const validatorToken = params.validatorToken as string;
        return (
          <>
            <div className="w-14 h-14 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
              <Droplets className="w-7 h-7 text-orange-500" />
            </div>
            <h1 className="text-xl font-semibold text-center mb-1">Remove Liquidity</h1>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Withdraw your liquidity from the pool
            </p>

            {/* Amount */}
            <div className="bg-orange-50 rounded-xl p-4 mb-4 text-center">
              <p className="text-xs text-orange-600 mb-1">LP Tokens to Burn</p>
              <p className="text-3xl font-bold text-orange-700">
                {formatAmount(BigInt(params.liquidity as string))}
              </p>
            </div>

            {/* Pool Tokens */}
            <div className="bg-muted/50 rounded-xl p-4 space-y-1">
              <DetailRow
                label="User Token"
                value={userToken}
                mono
                copyable
                onCopy={() => handleCopy(userToken, 'userToken')}
                copied={copiedField === 'userToken'}
              />
              <DetailRow
                label="Validator Token"
                value={validatorToken}
                mono
                copyable
                onCopy={() => handleCopy(validatorToken, 'validatorToken')}
                copied={copiedField === 'validatorToken'}
              />
              {showFeeToken && (
                <DetailRow label="Fee Token" value={formatAddress(feeToken!, 6)} mono />
              )}
            </div>
          </>
        );
      }

      default:
        return (
          <>
            <div className="w-14 h-14 rounded-2xl bg-gray-500/10 flex items-center justify-center mx-auto mb-4">
              <Coins className="w-7 h-7 text-gray-500" />
            </div>
            <h1 className="text-xl font-semibold text-center mb-1">Confirm Transaction</h1>
            <p className="text-sm text-muted-foreground text-center mb-4">
              {pendingRequest.appInfo.name} wants to send a transaction
            </p>
            <div className="bg-muted/50 rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-2">Raw Parameters:</p>
              <pre className="text-xs font-mono bg-white rounded-lg p-3 overflow-auto max-h-40 border border-border/50">
                {JSON.stringify(params, null, 2)}
              </pre>
            </div>
          </>
        );
    }
  };

  return (
    <>
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="bg-white border border-border/50 rounded-2xl shadow-sm overflow-hidden">
            {/* App Info Header */}
            <div className="px-6 pt-5 pb-3 border-b border-border/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  {pendingRequest.appInfo.icon ? (
                    <img
                      src={pendingRequest.appInfo.icon}
                      alt={pendingRequest.appInfo.name}
                      className="w-6 h-6"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded bg-primary/20" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{pendingRequest.appInfo.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {pendingRequest.appInfo.url}
                  </p>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="p-6">{renderRequestUI()}</div>

            {/* Wallet Required - if not authenticated */}
            {!isConnected && (
              <div className="px-6 pb-4">
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="w-4 h-4 text-amber-600" />
                    <p className="text-xs font-medium text-amber-700">Wallet Required</p>
                  </div>
                  <p className="text-sm text-amber-800 mb-3">
                    Sign in to your wallet to approve this request.
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
              </div>
            )}

            {/* Connected wallet info */}
            {isConnected && address && (
              <div className="px-6 pb-4">
                <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <p className="text-xs font-medium text-green-700">Signing with</p>
                  </div>
                  <p className="text-sm font-mono text-green-800">{formatAddress(address, 8)}</p>
                </div>
              </div>
            )}

            {/* Warning */}
            <div className="px-6 pb-4">
              <div className="flex items-start gap-2.5 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-amber-800 mb-0.5">
                    {requestType === 'sign_message' ? 'Signing Request' : 'Transaction Request'}
                  </p>
                  <p className="text-xs text-amber-700">
                    {requestType === 'sign_message'
                      ? 'Only sign messages from apps you trust. This signature may be used for authentication or authorization.'
                      : 'Review all details carefully before confirming. Blockchain transactions cannot be reversed.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex gap-3">
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
                {isConnected
                  ? requestType === 'sign_message'
                    ? 'Sign Message'
                    : 'Confirm & Send'
                  : 'Sign In First'}
              </Button>
            </div>
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
