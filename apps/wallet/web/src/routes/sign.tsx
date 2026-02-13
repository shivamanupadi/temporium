import { type ReactElement, useState, useEffect, useCallback, useRef } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useSignMessage, useWalletClient } from 'wagmi';
import { type Address } from 'viem';
import { Actions } from 'viem/tempo';
import { motion, AnimatePresence } from 'framer-motion';
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
  Droplets,
  FileSignature,
  AlertTriangle,
  Link2,
  Shield,
  Wallet,
  Coins,
  Send,
  ShoppingCart,
  ListOrdered,
  Ban,
  GitBranch,
  ShieldCheck,
  Sparkles,
  CirclePlus,
  Flame,
  Gift,
  ArrowUpFromLine,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CreateWalletModal } from '@temporium/shared-ui';
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
  | 'send_transaction'
  | 'buy_tokens'
  | 'place_order'
  | 'cancel_order'
  | 'create_pair'
  | 'approve_token'
  | 'create_token'
  | 'mint_token'
  | 'burn_token'
  | 'claim_rewards'
  | 'dex_withdraw';

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

interface RequestConfig {
  icon: typeof ArrowRight;
  color: string;
  title: string;
  subtitle: string;
}

const REQUEST_CONFIG: Record<RequestType, RequestConfig> = {
  sign_message: {
    icon: FileSignature,
    color: '#9B72CF',
    title: 'Sign Message',
    subtitle: 'Review the message before signing',
  },
  send_payment: {
    icon: Send,
    color: '#9B72CF',
    title: 'Send Payment',
    subtitle: 'Confirm the payment details',
  },
  send_scheduled_payment: {
    icon: Clock,
    color: '#9B72CF',
    title: 'Scheduled Payment',
    subtitle: 'Review the scheduled transfer',
  },
  swap_tokens: {
    icon: ArrowRightLeft,
    color: '#9B72CF',
    title: 'Swap Tokens',
    subtitle: 'Review the token swap',
  },
  add_liquidity: {
    icon: Droplets,
    color: '#5B9A6F',
    title: 'Add Liquidity',
    subtitle: 'Provide liquidity to the pool',
  },
  remove_liquidity: {
    icon: Droplets,
    color: '#5B9A6F',
    title: 'Remove Liquidity',
    subtitle: 'Withdraw from the pool',
  },
  send_transaction: {
    icon: Coins,
    color: '#9B72CF',
    title: 'Send Transaction',
    subtitle: 'Review the raw transaction',
  },
  buy_tokens: {
    icon: ShoppingCart,
    color: '#9B72CF',
    title: 'Buy Tokens',
    subtitle: 'Review the token purchase',
  },
  place_order: {
    icon: ListOrdered,
    color: '#9B72CF',
    title: 'Place Order',
    subtitle: 'Review the order details',
  },
  cancel_order: {
    icon: Ban,
    color: '#9B72CF',
    title: 'Cancel Order',
    subtitle: 'Cancel an existing order',
  },
  create_pair: {
    icon: GitBranch,
    color: '#9B72CF',
    title: 'Create Pair',
    subtitle: 'Create a new trading pair',
  },
  approve_token: {
    icon: ShieldCheck,
    color: '#5B9A6F',
    title: 'Approve Token',
    subtitle: 'Authorize token spending',
  },
  create_token: {
    icon: Sparkles,
    color: '#5B9A6F',
    title: 'Create Token',
    subtitle: 'Deploy a new token',
  },
  mint_token: {
    icon: CirclePlus,
    color: '#5B9A6F',
    title: 'Mint Tokens',
    subtitle: 'Mint new tokens',
  },
  burn_token: {
    icon: Flame,
    color: '#9B72CF',
    title: 'Burn Tokens',
    subtitle: 'Permanently destroy tokens',
  },
  claim_rewards: {
    icon: Gift,
    color: '#5B9A6F',
    title: 'Claim Rewards',
    subtitle: 'Claim your earned rewards',
  },
  dex_withdraw: {
    icon: ArrowUpFromLine,
    color: '#9B72CF',
    title: 'DEX Withdraw',
    subtitle: 'Withdraw from the DEX',
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
      'buy_tokens',
      'place_order',
      'cancel_order',
      'create_pair',
      'approve_token',
      'create_token',
      'mint_token',
      'burn_token',
      'claim_rewards',
      'dex_withdraw',
    ];

    const handleMessage = (event: MessageEvent): void => {
      const parsed = parseMessage(event);
      if (!parsed) return;

      const { request, origin } = parsed;
      if (!validMethods.includes(request.method)) return;

      console.log('[Sign] Received request:', request.method, 'from:', origin);

      if (!isAppConnected(origin)) {
        const appName = new URL(origin).hostname;
        setDisconnectedAppInfo({ name: appName, url: origin });
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
            token: Address;
            feeToken?: Address;
            memo?: `0x${string}`;
          };
          if (!params.to) throw new Error('Recipient required');

          hash = await Actions.token.transfer(walletClient, {
            token: params.token,
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
            token: Address;
            feeToken?: Address;
            memo?: `0x${string}`;
            scheduledFor: number;
          };
          if (!params.to || !params.scheduledFor) throw new Error('Missing required fields');

          hash = await Actions.token.transfer(walletClient, {
            token: params.token,
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
            userTokenAddress: Address;
            validatorTokenAddress: Address;
            validatorTokenAmount: string;
            feeToken?: Address;
          };
          if (!params.userTokenAddress || !params.validatorTokenAddress)
            throw new Error('Token addresses required');

          hash = await Actions.amm.mint(walletClient, {
            userTokenAddress: params.userTokenAddress,
            validatorTokenAddress: params.validatorTokenAddress,
            validatorTokenAmount: safeBigInt(params.validatorTokenAmount, 'Amount'),
            to: address,
            feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
          });
          break;
        }

        case 'remove_liquidity': {
          const params = request.params as {
            userTokenAddress: Address;
            validatorTokenAddress: Address;
            liquidity: string;
            feeToken?: Address;
          };
          if (!params.userTokenAddress || !params.validatorTokenAddress)
            throw new Error('Token addresses required');

          hash = await Actions.amm.burn(walletClient, {
            userToken: params.userTokenAddress,
            validatorToken: params.validatorTokenAddress,
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

        case 'buy_tokens': {
          const params = request.params as {
            tokenIn: Address;
            tokenOut: Address;
            amountOut: string;
            maxAmountIn: string;
            feeToken?: Address;
          };
          if (!params.tokenIn || !params.tokenOut) throw new Error('Token addresses required');

          hash = await Actions.dex.buy(walletClient, {
            tokenIn: params.tokenIn,
            tokenOut: params.tokenOut,
            amountOut: safeBigInt(params.amountOut, 'Amount out'),
            maxAmountIn: safeBigInt(params.maxAmountIn, 'Max amount in'),
            feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
          });
          break;
        }

        case 'place_order': {
          const params = request.params as {
            token: Address;
            amount: string;
            tick: number;
            type: 'buy' | 'sell';
            feeToken?: Address;
          };
          if (!params.token) throw new Error('Token address required');
          if (params.tick === undefined) throw new Error('Tick required');
          if (!params.type || !['buy', 'sell'].includes(params.type))
            throw new Error('Order type must be buy or sell');

          hash = await Actions.dex.place(walletClient, {
            token: params.token,
            amount: safeBigInt(params.amount, 'Amount'),
            tick: params.tick,
            type: params.type,
            feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
          });
          break;
        }

        case 'cancel_order': {
          const params = request.params as {
            orderId: string;
            feeToken?: Address;
          };
          if (!params.orderId) throw new Error('Order ID required');

          hash = await Actions.dex.cancel(walletClient, {
            orderId: safeBigInt(params.orderId, 'Order ID'),
            feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
          });
          break;
        }

        case 'create_pair': {
          const params = request.params as {
            base: Address;
            feeToken?: Address;
          };
          if (!params.base) throw new Error('Base token required');

          hash = await Actions.dex.createPair(walletClient, {
            base: params.base,
            feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
          });
          break;
        }

        case 'approve_token': {
          const params = request.params as {
            token: Address;
            spender: Address;
            amount: string;
            feeToken?: Address;
          };
          if (!params.token || !params.spender) throw new Error('Token and spender required');

          hash = await Actions.token.approve(walletClient, {
            token: params.token,
            spender: params.spender,
            amount: safeBigInt(params.amount, 'Amount'),
            feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
          });
          break;
        }

        case 'create_token': {
          const params = request.params as {
            name: string;
            symbol: string;
            currency: string;
            admin?: Address;
            quoteToken?: Address;
            salt?: `0x${string}`;
          };
          if (!params.name || !params.symbol || !params.currency)
            throw new Error('Name, symbol, and currency required');

          hash = await Actions.token.create(walletClient, {
            name: params.name,
            symbol: params.symbol,
            currency: params.currency,
            admin: params.admin,
            quoteToken: params.quoteToken,
            salt: params.salt,
          });
          break;
        }

        case 'mint_token': {
          const params = request.params as {
            token: Address;
            to: Address;
            amount: string;
            memo?: `0x${string}`;
            feeToken?: Address;
          };
          if (!params.token || !params.to) throw new Error('Token and recipient required');

          hash = await Actions.token.mint(walletClient, {
            token: params.token,
            to: params.to,
            amount: safeBigInt(params.amount, 'Amount'),
            memo: params.memo,
            feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
          });
          break;
        }

        case 'burn_token': {
          const params = request.params as {
            token: Address;
            amount: string;
            memo?: `0x${string}`;
            feeToken?: Address;
          };
          if (!params.token) throw new Error('Token address required');

          hash = await Actions.token.burn(walletClient, {
            token: params.token,
            amount: safeBigInt(params.amount, 'Amount'),
            memo: params.memo,
            feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
          });
          break;
        }

        case 'claim_rewards': {
          const params = request.params as {
            token: Address;
            feeToken?: Address;
          };
          if (!params.token) throw new Error('Token address required');

          hash = await Actions.reward.claim(walletClient, {
            token: params.token,
            feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
          });
          break;
        }

        case 'dex_withdraw': {
          const params = request.params as {
            token: Address;
            amount: string;
            feeToken?: Address;
          };
          if (!params.token) throw new Error('Token address required');

          hash = await Actions.dex.withdraw(walletClient, {
            token: params.token,
            amount: safeBigInt(params.amount, 'Amount'),
            feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
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

    if (isConnected && address && walletClient) {
      saveConnectedApp({
        name: disconnectedAppInfo.name,
        url: sourceOrigin,
        connectedAt: Date.now(),
        lastUsedAt: Date.now(),
        permissions: ['connect', 'sign', 'send'],
      });

      setDisconnectedAppInfo(null);

      if (pendingRequest) {
        shouldExecuteAfterAuth.current = false;
        setPendingAction(null);
        setStatus('waiting');
        toast.success('App reconnected! Processing your request...');
        setTimeout(() => executeTransaction(), 300);
      } else {
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

  // Helper to get config
  const getConfig = (): RequestConfig => REQUEST_CONFIG[requestType || 'send_transaction'];

  // --- Status: Not Connected ---
  if (status === 'not_connected') {
    return (
      <>
        <div className="min-h-screen bg-[#FDFBF8] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-[380px]"
          >
            <div className="bg-white rounded-2xl border border-border/60 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="relative px-6 pt-8 pb-5 text-center">
                <div className="absolute inset-0 bg-gradient-to-b from-[#D97706]/[0.03] to-transparent pointer-events-none" />
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                    <Link2 className="w-7 h-7 text-amber-600" />
                  </div>
                  <h1 className="text-[17px] font-semibold text-[#2D3436] mb-1.5">
                    App Not Connected
                  </h1>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    This app&apos;s connection was revoked or has expired.
                  </p>
                </div>
              </div>

              {/* Divider */}
              <div className="mx-6 border-t border-border/40" />

              {/* App Info */}
              {disconnectedAppInfo && (
                <div className="px-6 py-4">
                  <div className="flex items-center gap-3 px-4 py-3 bg-[#FDFBF8] rounded-xl border border-border/30">
                    <div className="w-10 h-10 rounded-xl bg-[#F5F2ED] border border-border/30 flex items-center justify-center shrink-0">
                      <Globe className="w-5 h-5 text-[#9B9590]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-[#2D3436] truncate">
                        {disconnectedAppInfo.name}
                      </p>
                      <p className="text-[11px] text-[#9B9590] truncate">
                        {disconnectedAppInfo.url}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Divider */}
              <div className="mx-6 border-t border-border/40" />

              {/* Auth & Actions */}
              <div className="px-6 py-5">
                {isConnected && address ? (
                  <>
                    <div className="flex items-center gap-3 px-4 py-3 bg-[#5B9A6F]/6 rounded-xl border border-[#5B9A6F]/15 mb-4">
                      <div className="w-9 h-9 rounded-xl bg-[#5B9A6F]/12 flex items-center justify-center shrink-0">
                        <Shield className="w-4 h-4 text-[#5B9A6F]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold text-[#5B9A6F]">Wallet Ready</p>
                        <p className="text-[11px] font-mono text-[#5B9A6F]/70 truncate">
                          {formatAddress(address, 6)}
                        </p>
                      </div>
                    </div>
                    <p className="text-[13px] text-muted-foreground text-center mb-4">
                      Click below to reconnect this app to your wallet.
                    </p>
                    <div className="flex gap-2.5">
                      <Button
                        variant="outline"
                        className="flex-1 h-11 rounded-xl text-[13px] border-border/40"
                        onClick={handleCancelNotConnected}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-[#5B9A6F] hover:bg-[#4A8A5E] text-white"
                        onClick={handleReconnect}
                      >
                        <Link2 className="w-4 h-4 mr-1.5" />
                        Reconnect
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[13px] text-muted-foreground text-center mb-4">
                      Sign in to your wallet to reconnect this app.
                    </p>
                    <div className="flex gap-2 mb-3">
                      <Button
                        variant="outline"
                        className="flex-1 h-10 rounded-xl text-[13px] border-border/40"
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
                        Create Wallet
                      </Button>
                    </div>
                    <button
                      onClick={handleCancelNotConnected}
                      className="w-full py-2 text-[12px] text-[#9B9590] hover:text-[#6B6560] transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
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

  // --- Status: No pending request ---
  if (!pendingRequest) {
    return (
      <div className="min-h-screen bg-[#FDFBF8] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[380px]"
        >
          <div className="bg-white rounded-2xl border border-border/60 shadow-sm overflow-hidden">
            <div className="px-6 py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
              <h1 className="text-[16px] font-semibold text-[#2D3436] mb-1.5">
                Waiting for Request
              </h1>
              <p className="text-[13px] text-muted-foreground mb-6">
                Waiting for an app to request signing...
              </p>
              <Button
                variant="outline"
                onClick={() => navigate({ to: '/' })}
                className="h-11 px-6 rounded-xl text-[13px] border-border/40"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Go to Wallet
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // --- Status: Success ---
  if (status === 'success') {
    const config = getConfig();
    return (
      <div className="min-h-screen bg-[#FDFBF8] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="w-full max-w-[380px]"
        >
          <div className="bg-white rounded-2xl border border-border/60 shadow-sm overflow-hidden">
            <div className="relative px-6 py-10 text-center">
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
                <h1 className="text-[17px] font-semibold text-[#2D3436] mb-1.5">
                  {requestType === 'sign_message' ? 'Message Signed' : 'Transaction Sent'}
                </h1>
                <p className="text-[13px] text-muted-foreground mb-1">
                  {requestType === 'sign_message'
                    ? 'Signature complete'
                    : `${config.title} submitted successfully`}
                </p>
                {txHash && (
                  <a
                    href={getExplorerTxUrl(txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-lg bg-[#5B9A6F]/8 text-[12px] font-semibold text-[#5B9A6F] hover:bg-[#5B9A6F]/12 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View on Explorer
                  </a>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // --- Status: Rejected ---
  if (status === 'rejected') {
    return (
      <div className="min-h-screen bg-[#FDFBF8] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-[380px]"
        >
          <div className="bg-white rounded-2xl border border-border/60 shadow-sm overflow-hidden">
            <div className="px-6 py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#F5F2ED] flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-7 h-7 text-[#9B9590]" />
              </div>
              <h1 className="text-[16px] font-semibold text-[#2D3436] mb-1.5">Request Rejected</h1>
              <p className="text-[13px] text-muted-foreground">You declined the request</p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // --- Status: Timeout ---
  if (status === 'timeout') {
    return (
      <div className="min-h-screen bg-[#FDFBF8] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-[380px]"
        >
          <div className="bg-white rounded-2xl border border-border/60 shadow-sm overflow-hidden">
            <div className="px-6 py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#F5F2ED] flex items-center justify-center mx-auto mb-4">
                <Clock className="w-7 h-7 text-[#9B9590]" />
              </div>
              <h1 className="text-[16px] font-semibold text-[#2D3436] mb-1.5">Request Expired</h1>
              <p className="text-[13px] text-muted-foreground">The signing request has timed out</p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // --- Status: Error ---
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#FDFBF8] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-[380px]"
        >
          <div className="bg-white rounded-2xl border border-border/60 shadow-sm overflow-hidden">
            <div className="relative px-6 pt-10 pb-6 text-center">
              <div className="absolute inset-0 bg-gradient-to-b from-red-500/[0.03] to-transparent pointer-events-none" />
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-7 h-7 text-red-500" />
                </div>
                <h1 className="text-[16px] font-semibold text-[#2D3436] mb-1.5">Request Failed</h1>
                <p className="text-[13px] text-muted-foreground">
                  {error || 'Something went wrong'}
                </p>
              </div>
            </div>
            <div className="px-5 pb-5 flex items-center gap-2.5">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl text-[13px] border-border/40"
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

  // --- Main request UI ---
  const request = pendingRequest.request as TransactionRequest;
  const params = request.params || {};
  const config = getConfig();
  const Icon = config.icon;
  const memo = decodeMemo(params.memo as string | undefined);

  return (
    <>
      <div className="min-h-screen bg-[#FDFBF8] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-[380px]"
        >
          <div className="bg-white rounded-2xl border border-border/60 shadow-sm overflow-hidden">
            {/* Header: App info + request type */}
            <div className="relative px-6 pt-6 pb-5">
              <div
                className="absolute inset-0 bg-gradient-to-b to-transparent pointer-events-none"
                style={{ background: `linear-gradient(to bottom, ${config.color}06, transparent)` }}
              />

              <div className="relative">
                {/* App row */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-[#F5F2ED] border border-border/30 flex items-center justify-center overflow-hidden shrink-0">
                    {pendingRequest.appInfo.icon ? (
                      <img
                        src={pendingRequest.appInfo.icon}
                        alt=""
                        className="w-10 h-10 rounded-xl object-cover"
                      />
                    ) : (
                      <Globe className="w-5 h-5 text-[#9B9590]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[#2D3436] truncate">
                      {pendingRequest.appInfo.name}
                    </p>
                    <p className="text-[11px] text-[#9B9590] font-mono truncate">
                      {pendingRequest.appInfo.url}
                    </p>
                  </div>
                </div>

                {/* Request type badge */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${config.color}12` }}
                  >
                    <Icon className="w-5.5 h-5.5" style={{ color: config.color }} />
                  </div>
                  <div>
                    <h1 className="text-[16px] font-semibold text-[#2D3436]">{config.title}</h1>
                    <p className="text-[12px] text-[#9B9590]">{config.subtitle}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="mx-6 border-t border-border/40" />

            {/* Request Details */}
            <div className="px-6 py-5">
              {requestType === 'sign_message' ? (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">
                    Message
                  </p>
                  <div className="bg-[#FDFBF8] rounded-xl px-4 py-3.5 border border-border/30 max-h-36 overflow-auto">
                    <p className="text-[13px] font-mono text-[#2D3436] break-all whitespace-pre-wrap leading-relaxed">
                      {(params as { message?: string }).message || '(empty)'}
                    </p>
                  </div>
                </div>
              ) : requestType === 'send_payment' || requestType === 'send_scheduled_payment' ? (
                <div className="space-y-4">
                  {/* Amount card */}
                  <div
                    className="rounded-xl px-5 py-5 text-center"
                    style={{ backgroundColor: `${config.color}08` }}
                  >
                    <p
                      className="text-[11px] font-semibold mb-1.5 uppercase tracking-widest"
                      style={{ color: config.color }}
                    >
                      Amount
                    </p>
                    <p className="text-3xl font-bold text-[#2D3436] tracking-tight">
                      {safeDisplayAmount(params.amount as string)}
                    </p>
                    <p className="text-[12px] font-medium mt-0.5" style={{ color: config.color }}>
                      USD
                    </p>
                  </div>

                  {/* Scheduled time */}
                  {requestType === 'send_scheduled_payment' &&
                    params.scheduledFor !== null &&
                    params.scheduledFor !== undefined && (
                      <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 rounded-xl border border-amber-100">
                        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                        <div>
                          <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest">
                            Scheduled for
                          </p>
                          <p className="text-[13px] font-medium text-[#2D3436]">
                            {new Date((params.scheduledFor as number) * 1000).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}

                  {/* Details */}
                  <div className="space-y-0">
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
                  {/* Swap visual */}
                  <div className="bg-[#FDFBF8] rounded-xl border border-border/30 overflow-hidden">
                    <div className="px-5 py-4">
                      <p className="text-[10px] font-semibold text-[#9B9590] uppercase tracking-widest mb-1">
                        You pay
                      </p>
                      <p className="text-2xl font-bold text-[#2D3436]">
                        {safeDisplayAmount(params.amountIn as string)}
                      </p>
                    </div>
                    <div className="relative">
                      <div className="border-t border-border/30" />
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center border-2 border-white"
                          style={{ backgroundColor: config.color }}
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>
                    </div>
                    <div className="px-5 py-4">
                      <p className="text-[10px] font-semibold text-[#9B9590] uppercase tracking-widest mb-1">
                        You receive (min)
                      </p>
                      <p className="text-2xl font-bold" style={{ color: config.color }}>
                        {safeDisplayAmount(params.minAmountOut as string)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-0">
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
                  {/* Amount card */}
                  <div
                    className="rounded-xl px-5 py-5 text-center"
                    style={{ backgroundColor: `${config.color}08` }}
                  >
                    <p
                      className="text-[11px] font-semibold mb-1.5 uppercase tracking-widest"
                      style={{ color: config.color }}
                    >
                      {requestType === 'add_liquidity' ? 'Amount' : 'LP Tokens'}
                    </p>
                    <p className="text-3xl font-bold text-[#2D3436] tracking-tight">
                      {safeDisplayAmount(
                        (requestType === 'add_liquidity'
                          ? params.validatorTokenAmount
                          : params.liquidity) as string
                      )}
                    </p>
                  </div>
                  <div className="space-y-0">
                    <DetailRow
                      label="User Token"
                      value={formatAddress(params.userTokenAddress as string, 6)}
                      copyValue={params.userTokenAddress as string}
                      onCopy={handleCopy}
                      copiedField={copiedField}
                      fieldKey="userTokenAddress"
                    />
                    <DetailRow
                      label="Validator Token"
                      value={formatAddress(params.validatorTokenAddress as string, 6)}
                      copyValue={params.validatorTokenAddress as string}
                      onCopy={handleCopy}
                      copiedField={copiedField}
                      fieldKey="validatorTokenAddress"
                    />
                  </div>
                </div>
              ) : requestType === 'buy_tokens' ? (
                <div className="space-y-4">
                  <div className="bg-[#FDFBF8] rounded-xl border border-border/30 overflow-hidden">
                    <div className="px-5 py-4">
                      <p className="text-[10px] font-semibold text-[#9B9590] uppercase tracking-widest mb-1">
                        You receive
                      </p>
                      <p className="text-2xl font-bold" style={{ color: config.color }}>
                        {safeDisplayAmount(params.amountOut as string)}
                      </p>
                    </div>
                    <div className="relative">
                      <div className="border-t border-border/30" />
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center border-2 border-white"
                          style={{ backgroundColor: config.color }}
                        >
                          <ShoppingCart className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>
                    </div>
                    <div className="px-5 py-4">
                      <p className="text-[10px] font-semibold text-[#9B9590] uppercase tracking-widest mb-1">
                        Max you pay
                      </p>
                      <p className="text-2xl font-bold text-[#2D3436]">
                        {safeDisplayAmount(params.maxAmountIn as string)}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-0">
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
              ) : requestType === 'place_order' ? (
                <div className="space-y-4">
                  <div
                    className="rounded-xl px-5 py-5 text-center"
                    style={{ backgroundColor: `${config.color}08` }}
                  >
                    <p
                      className="text-[11px] font-semibold mb-1.5 uppercase tracking-widest"
                      style={{ color: config.color }}
                    >
                      {(params.type as string) === 'buy' ? 'Buy' : 'Sell'} Amount
                    </p>
                    <p className="text-3xl font-bold text-[#2D3436] tracking-tight">
                      {safeDisplayAmount(params.amount as string)}
                    </p>
                  </div>
                  <div className="space-y-0">
                    <DetailRow
                      label="Type"
                      value={(params.type as string) === 'buy' ? 'Buy' : 'Sell'}
                    />
                    <DetailRow label="Tick" value={String(params.tick)} />
                    <DetailRow
                      label="Token"
                      value={formatAddress(params.token as string, 6)}
                      copyValue={params.token as string}
                      onCopy={handleCopy}
                      copiedField={copiedField}
                      fieldKey="token"
                    />
                  </div>
                </div>
              ) : requestType === 'cancel_order' ? (
                <div className="space-y-4">
                  <div
                    className="rounded-xl px-5 py-5 text-center"
                    style={{ backgroundColor: `${config.color}08` }}
                  >
                    <p
                      className="text-[11px] font-semibold mb-1.5 uppercase tracking-widest"
                      style={{ color: config.color }}
                    >
                      Order ID
                    </p>
                    <p className="text-2xl font-bold text-[#2D3436] tracking-tight font-mono">
                      #{String(params.orderId)}
                    </p>
                  </div>
                </div>
              ) : requestType === 'create_pair' ? (
                <div className="space-y-4">
                  <div className="space-y-0">
                    <DetailRow
                      label="Base Token"
                      value={formatAddress(params.base as string, 6)}
                      copyValue={params.base as string}
                      onCopy={handleCopy}
                      copiedField={copiedField}
                      fieldKey="base"
                    />
                  </div>
                </div>
              ) : requestType === 'approve_token' ? (
                <div className="space-y-4">
                  <div
                    className="rounded-xl px-5 py-5 text-center"
                    style={{ backgroundColor: `${config.color}08` }}
                  >
                    <p
                      className="text-[11px] font-semibold mb-1.5 uppercase tracking-widest"
                      style={{ color: config.color }}
                    >
                      Approval Amount
                    </p>
                    <p className="text-3xl font-bold text-[#2D3436] tracking-tight">
                      {safeDisplayAmount(params.amount as string)}
                    </p>
                  </div>
                  <div className="space-y-0">
                    <DetailRow
                      label="Token"
                      value={formatAddress(params.token as string, 6)}
                      copyValue={params.token as string}
                      onCopy={handleCopy}
                      copiedField={copiedField}
                      fieldKey="token"
                    />
                    <DetailRow
                      label="Spender"
                      value={formatAddress(params.spender as string, 6)}
                      copyValue={params.spender as string}
                      onCopy={handleCopy}
                      copiedField={copiedField}
                      fieldKey="spender"
                    />
                  </div>
                </div>
              ) : requestType === 'create_token' ? (
                <div className="space-y-4">
                  <div
                    className="rounded-xl px-5 py-5 text-center"
                    style={{ backgroundColor: `${config.color}08` }}
                  >
                    <p
                      className="text-[11px] font-semibold mb-1.5 uppercase tracking-widest"
                      style={{ color: config.color }}
                    >
                      New Token
                    </p>
                    <p className="text-2xl font-bold text-[#2D3436] tracking-tight">
                      {params.symbol as string}
                    </p>
                    <p className="text-[13px] text-[#9B9590] mt-1">{params.name as string}</p>
                  </div>
                  <div className="space-y-0">
                    <DetailRow label="Currency" value={params.currency as string} />
                    {(params.admin as string | undefined) && (
                      <DetailRow
                        label="Admin"
                        value={formatAddress(params.admin as string, 6)}
                        copyValue={params.admin as string}
                        onCopy={handleCopy}
                        copiedField={copiedField}
                        fieldKey="admin"
                      />
                    )}
                  </div>
                </div>
              ) : requestType === 'mint_token' ? (
                <div className="space-y-4">
                  <div
                    className="rounded-xl px-5 py-5 text-center"
                    style={{ backgroundColor: `${config.color}08` }}
                  >
                    <p
                      className="text-[11px] font-semibold mb-1.5 uppercase tracking-widest"
                      style={{ color: config.color }}
                    >
                      Mint Amount
                    </p>
                    <p className="text-3xl font-bold text-[#2D3436] tracking-tight">
                      {safeDisplayAmount(params.amount as string)}
                    </p>
                  </div>
                  <div className="space-y-0">
                    <DetailRow
                      label="Token"
                      value={formatAddress(params.token as string, 6)}
                      copyValue={params.token as string}
                      onCopy={handleCopy}
                      copiedField={copiedField}
                      fieldKey="token"
                    />
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
              ) : requestType === 'burn_token' ? (
                <div className="space-y-4">
                  <div
                    className="rounded-xl px-5 py-5 text-center"
                    style={{ backgroundColor: `${config.color}08` }}
                  >
                    <p
                      className="text-[11px] font-semibold mb-1.5 uppercase tracking-widest"
                      style={{ color: config.color }}
                    >
                      Burn Amount
                    </p>
                    <p className="text-3xl font-bold text-[#2D3436] tracking-tight">
                      {safeDisplayAmount(params.amount as string)}
                    </p>
                  </div>
                  <div className="space-y-0">
                    <DetailRow
                      label="Token"
                      value={formatAddress(params.token as string, 6)}
                      copyValue={params.token as string}
                      onCopy={handleCopy}
                      copiedField={copiedField}
                      fieldKey="token"
                    />
                    {memo && <DetailRow label="Memo" value={memo} />}
                  </div>
                </div>
              ) : requestType === 'claim_rewards' ? (
                <div className="space-y-4">
                  <div className="space-y-0">
                    <DetailRow
                      label="Token"
                      value={formatAddress(params.token as string, 6)}
                      copyValue={params.token as string}
                      onCopy={handleCopy}
                      copiedField={copiedField}
                      fieldKey="token"
                    />
                  </div>
                </div>
              ) : requestType === 'dex_withdraw' ? (
                <div className="space-y-4">
                  <div
                    className="rounded-xl px-5 py-5 text-center"
                    style={{ backgroundColor: `${config.color}08` }}
                  >
                    <p
                      className="text-[11px] font-semibold mb-1.5 uppercase tracking-widest"
                      style={{ color: config.color }}
                    >
                      Withdraw Amount
                    </p>
                    <p className="text-3xl font-bold text-[#2D3436] tracking-tight">
                      {safeDisplayAmount(params.amount as string)}
                    </p>
                  </div>
                  <div className="space-y-0">
                    <DetailRow
                      label="Token"
                      value={formatAddress(params.token as string, 6)}
                      copyValue={params.token as string}
                      onCopy={handleCopy}
                      copiedField={copiedField}
                      fieldKey="token"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">
                    Transaction Data
                  </p>
                  <pre className="text-[11px] font-mono bg-[#FDFBF8] rounded-xl px-4 py-3.5 overflow-auto max-h-36 border border-border/30 text-[#6B6560]">
                    {JSON.stringify(params, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="mx-6 border-t border-border/40" />

            {/* Wallet Status */}
            <div className="px-6 py-4">
              <AnimatePresence mode="wait">
                {isConnected && address ? (
                  <motion.div
                    key="connected"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-3 px-4 py-3 bg-[#5B9A6F]/6 rounded-xl border border-[#5B9A6F]/15"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#5B9A6F]/12 flex items-center justify-center shrink-0">
                      <Shield className="w-4 h-4 text-[#5B9A6F]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-[#5B9A6F]">Signing with</p>
                      <p className="text-[11px] font-mono text-[#5B9A6F]/70 truncate">
                        {formatAddress(address, 6)}
                      </p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-[#5B9A6F] shrink-0" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="not-connected"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-[#FDFBF8] rounded-xl border border-border/40 px-4 py-4"
                  >
                    <p className="text-[13px] font-semibold text-[#2D3436] mb-3">
                      Sign in to continue
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 h-9 rounded-xl text-[12px] border-border/40"
                        onClick={() => setShowWalletSelectModal(true)}
                        disabled={isConnecting}
                      >
                        <Fingerprint className="w-3.5 h-3.5 mr-1.5" />
                        Sign In
                      </Button>
                      <Button
                        className="flex-1 h-9 rounded-xl text-[12px] font-semibold bg-[#2D3436] hover:bg-[#3D4446] text-white"
                        onClick={() => setShowCreateWalletModal(true)}
                        disabled={isConnecting}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        Create
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Warning */}
            <div className="mx-6 border-t border-border/40" />
            <div className="px-6 py-3.5">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-[11px] text-[#9B9590] leading-relaxed">
                  {requestType === 'sign_message'
                    ? 'Only sign messages from apps you trust.'
                    : 'Review carefully. Transactions cannot be reversed once confirmed.'}
                </p>
              </div>
            </div>

            {/* Timer */}
            {timeRemaining !== null && timeRemaining > 0 && (
              <>
                <div className="mx-6 border-t border-border/40" />
                <div className="px-6 py-3">
                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#B5B0AA]">
                    <Clock className="w-3 h-3" />
                    <span>
                      Expires in {Math.floor(timeRemaining / 60)}:
                      {(timeRemaining % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Divider */}
            <div className="mx-6 border-t border-border/40" />

            {/* Actions */}
            <div className="px-5 py-5 flex items-center gap-2.5">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl text-[13px] border-border/40"
                onClick={handleReject}
                disabled={status === 'processing' || isConnecting}
              >
                Reject
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl text-[13px] font-semibold text-white"
                style={{ backgroundColor: config.color }}
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
              <div className="px-5 pb-4 flex items-center justify-center gap-4 text-[10px] text-[#B5B0AA]">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-[#F5F2ED] rounded text-[9px] font-mono text-[#9B9590]">
                    Enter
                  </kbd>
                  <span>{requestType === 'sign_message' ? 'sign' : 'confirm'}</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-[#F5F2ED] rounded text-[9px] font-mono text-[#9B9590]">
                    Esc
                  </kbd>
                  <span>reject</span>
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
    <div className="flex items-center justify-between py-2.5 border-b border-border/20 last:border-0">
      <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-widest">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <span className="text-[12px] text-[#2D3436] font-mono">{value}</span>
        {copyValue && onCopy && fieldKey && (
          <button
            onClick={() => onCopy(copyValue, fieldKey)}
            className="p-1 hover:bg-[#F5F2ED] rounded-md transition-colors"
          >
            {copiedField === fieldKey ? (
              <Check className="w-3 h-3 text-[#5B9A6F]" />
            ) : (
              <Copy className="w-3 h-3 text-[#B5B0AA]" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
