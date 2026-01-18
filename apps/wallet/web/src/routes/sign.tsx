import { type ReactElement, useState, useEffect, useCallback } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useAccount, useConnect, useSignMessage, useWalletClient } from 'wagmi';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { tempoPasskeyConnector } from '@/lib/wagmi';
import { getExplorerTxUrl } from '@/lib/tempo-client';
import { DEFAULT_FEE_TOKEN_ADDRESS } from '@/lib/constants';
import {
  parseMessage,
  sendResponse,
  handleSignMessageRequest,
  handleSendTransactionRequest,
  createSignMessageResponse,
} from '@/lib/wallet-connect';
import { isAppConnected } from '@/lib/connected-apps';
import type { SignMessageRequest, PendingRequest } from '@/types';
import { formatAddress, formatAmount } from '@/lib/utils';

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
  const { address, isConnected } = useAccount();
  const { connectAsync } = useConnect();
  const { signMessageAsync } = useSignMessage();
  const { data: walletClient } = useWalletClient();

  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [requestType, setRequestType] = useState<RequestType | null>(null);
  const [status, setStatus] = useState<'waiting' | 'processing' | 'success' | 'error'>('waiting');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [sourceWindow, setSourceWindow] = useState<Window | null>(null);
  const [sourceOrigin, setSourceOrigin] = useState<string | null>(null);

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

  const handleApprove = useCallback(async () => {
    if (!pendingRequest || !sourceOrigin) return;

    setStatus('processing');

    try {
      // Ensure wallet is connected
      if (!isConnected) {
        await connectAsync({ connector: tempoPasskeyConnector });
      }

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
  }, [
    pendingRequest,
    sourceOrigin,
    sourceWindow,
    isConnected,
    connectAsync,
    signMessageAsync,
    walletClient,
    address,
  ]);

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
    switch (requestType) {
      case 'sign_message':
        return (
          <>
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <FileSignature className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-xl font-semibold text-center mb-1">Sign Message</h1>
            <p className="text-sm text-muted-foreground text-center">
              {pendingRequest.appInfo.name} wants you to sign a message
            </p>
            <div className="mt-6 p-4 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-2">Message to sign:</p>
              <p className="text-sm font-mono break-all whitespace-pre-wrap">
                {(params as { message?: string }).message}
              </p>
            </div>
          </>
        );

      case 'send_payment':
        return (
          <>
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Send className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-xl font-semibold text-center mb-1">Send Payment</h1>
            <p className="text-sm text-muted-foreground text-center">
              {pendingRequest.appInfo.name} wants to send a payment
            </p>
            <div className="mt-6 p-4 bg-muted/50 rounded-lg space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">To</p>
                <p className="text-sm font-mono">{formatAddress(params.to as string, 8)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Amount</p>
                <p className="text-lg font-semibold">
                  {formatAmount(BigInt(params.amount as string))} USD
                </p>
              </div>
            </div>
          </>
        );

      case 'send_scheduled_payment':
        const scheduledFor = params.scheduledFor as number;
        const scheduledDate = new Date(scheduledFor * 1000);
        return (
          <>
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-xl font-semibold text-center mb-1">Scheduled Payment</h1>
            <p className="text-sm text-muted-foreground text-center">
              {pendingRequest.appInfo.name} wants to schedule a payment
            </p>
            <div className="mt-6 p-4 bg-muted/50 rounded-lg space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">To</p>
                <p className="text-sm font-mono">{formatAddress(params.to as string, 8)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Amount</p>
                <p className="text-lg font-semibold">
                  {formatAmount(BigInt(params.amount as string))} USD
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Scheduled For</p>
                <p className="text-sm">{scheduledDate.toLocaleString()}</p>
              </div>
            </div>
          </>
        );

      case 'swap_tokens':
        return (
          <>
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <ArrowRightLeft className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-xl font-semibold text-center mb-1">Swap Tokens</h1>
            <p className="text-sm text-muted-foreground text-center">
              {pendingRequest.appInfo.name} wants to swap tokens
            </p>
            <div className="mt-6 p-4 bg-muted/50 rounded-lg space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Swap</p>
                <p className="text-lg font-semibold">
                  {formatAmount(BigInt(params.amountIn as string))}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Minimum Receive</p>
                <p className="text-lg font-semibold">
                  {formatAmount(BigInt(params.minAmountOut as string))}
                </p>
              </div>
            </div>
          </>
        );

      case 'add_liquidity':
        return (
          <>
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Droplets className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-xl font-semibold text-center mb-1">Add Liquidity</h1>
            <p className="text-sm text-muted-foreground text-center">
              {pendingRequest.appInfo.name} wants to add liquidity
            </p>
            <div className="mt-6 p-4 bg-muted/50 rounded-lg space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Amount</p>
                <p className="text-lg font-semibold">
                  {formatAmount(BigInt(params.validatorTokenAmount as string))}
                </p>
              </div>
            </div>
          </>
        );

      case 'remove_liquidity':
        return (
          <>
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Droplets className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-xl font-semibold text-center mb-1">Remove Liquidity</h1>
            <p className="text-sm text-muted-foreground text-center">
              {pendingRequest.appInfo.name} wants to remove liquidity
            </p>
            <div className="mt-6 p-4 bg-muted/50 rounded-lg space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">LP Tokens</p>
                <p className="text-lg font-semibold">
                  {formatAmount(BigInt(params.liquidity as string))}
                </p>
              </div>
            </div>
          </>
        );

      default:
        return (
          <>
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Send className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-xl font-semibold text-center mb-1">Confirm Transaction</h1>
            <p className="text-sm text-muted-foreground text-center">
              {pendingRequest.appInfo.name} wants to send a transaction
            </p>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="bg-white border border-border/50 rounded-2xl shadow-sm overflow-hidden">
          {/* Header & Content */}
          <div className="p-6 border-b border-border/50">{renderRequestUI()}</div>

          {/* Warning */}
          {requestType !== 'sign_message' && (
            <div className="px-6 py-4">
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">
                  Review details carefully. This action cannot be undone.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="p-6 pt-0 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={handleReject}>
              Reject
            </Button>
            <Button className="flex-1" onClick={handleApprove} isLoading={status === 'processing'}>
              {requestType === 'sign_message' ? 'Sign' : 'Confirm'}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
