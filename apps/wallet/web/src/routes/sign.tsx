import { type ReactElement, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useSignMessage, useWalletClient } from 'wagmi';
import { type Address, decodeFunctionData } from 'viem';
import { Abis, Actions } from 'viem/tempo';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  Clock,
  Copy,
  Check,
  FileSignature,
  AlertTriangle,
  Link2,
  Wallet,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { CreateWalletModal } from '@temporium/shared-ui';
import { WalletSelectModal } from '@/components/WalletSelectModal';
import { useTempo } from '@/hooks/useTempo';
import { useTokenList } from '@/hooks/useTokenList';
import { useFeePreference } from '@/hooks/useFeePreference';
import { FeeTokenPicker } from '@/components/FeeTokenPicker';
import { getExplorerTxUrl, tempoPublicClient } from '@/lib/tempo-client';
import { TIMING } from '@/lib/constants';
import { tempoChain } from '@/lib/tempo-client';
import {
  parseMessage,
  sendResponse,
  handleSignMessageRequest,
  createSignMessageResponse,
  WalletConnectErrorCode,
  getErrorCode,
  createErrorResponse,
} from '@/lib/gateway-connect-protocol';
import { isAppConnected, hasPermission, saveConnectedApp } from '@/lib/connected-apps';
import { addActivity } from '@/lib/activity';
import type { SignMessageRequest, PendingRequest, ActivityType } from '@/types';
import { formatAddress, formatAmount, copyToClipboard } from '@/lib/utils';

export const Route = createFileRoute('/sign')({
  component: SignPage,
});

type RequestType = 'sign_message' | 'sign_transaction';

interface TransactionRequest {
  id: string;
  method: string;
  origin: string;
  timestamp: number;
  params: Record<string, unknown>;
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

/**
 * Deserialize BigInt values from postMessage transport.
 * Inverse of the SDK's serializeTxForTransport.
 */
function deserializeTxFromTransport(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && value.startsWith('__bigint:')) {
      result[key] = BigInt(value.slice(9));
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = deserializeTxFromTransport(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

interface RequestConfig {
  icon: typeof FileSignature;
  title: string;
  subtitle: string;
}

const REQUEST_CONFIG: Record<RequestType, RequestConfig> = {
  sign_message: {
    icon: FileSignature,
    title: 'Sign Message',
    subtitle: 'Review the message before signing',
  },
  sign_transaction: {
    icon: FileSignature,
    title: 'Sign Transaction',
    subtitle: 'Review and sign the transaction',
  },
};

interface TokenMeta {
  name: string;
  symbol: string;
  decimals: number;
}

/** A single decoded argument from a contract call */
interface DecodedArg {
  name: string;
  type: string;
  value: unknown;
}

/** Result of decoding tx calldata */
interface DecodedTx {
  functionName: string;
  label: string;
  args: DecodedArg[];
  /** The contract address (tx.to) */
  contractAddress: Address;
}

const KNOWN_ABIS = [
  Abis.tip20,
  Abis.feeAmm,
  Abis.stablecoinDex,
  Abis.accountKeychain,
  Abis.tip20Factory,
] as const;

const TRANSFER_FUNCTIONS = new Set([
  'transfer',
  'transferWithMemo',
  'transferFrom',
  'transferFromWithMemo',
]);

/** Humanise a camelCase function name → "Transfer With Memo" */
function humaniseFnName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

function tryDecodeTx(params: Record<string, unknown>): DecodedTx | null {
  const data = params.data as `0x${string}` | undefined;
  const to = params.to as Address | undefined;
  if (!data || !to) return null;

  for (const abi of KNOWN_ABIS) {
    try {
      const decoded = decodeFunctionData({ abi, data });
      // Find the matching ABI entry to get arg names/types
      const abiEntry = (abi as readonly any[]).find(
        (e: any) => e.type === 'function' && e.name === decoded.functionName
      );
      const inputs: { name: string; type: string }[] = abiEntry?.inputs ?? [];
      const args: DecodedArg[] = (decoded.args as readonly unknown[]).map((value, i) => ({
        name: inputs[i]?.name ?? `arg${i}`,
        type: inputs[i]?.type ?? 'unknown',
        value,
      }));

      return {
        functionName: decoded.functionName,
        label: humaniseFnName(decoded.functionName),
        args,
        contractAddress: to,
      };
    } catch {
      // try next ABI
    }
  }
  return null;
}

/** Check if a decoded tx is a token transfer variant */
function isTransfer(decoded: DecodedTx | null): boolean {
  return decoded !== null && TRANSFER_FUNCTIONS.has(decoded.functionName);
}

/** Get the transfer amount from decoded args */
function getTransferAmount(decoded: DecodedTx): bigint {
  const amountArg = decoded.args.find(a => a.name === 'amount');
  return (amountArg?.value as bigint) ?? 0n;
}

function decodeMemo(memo: `0x${string}`): string {
  try {
    const hex = memo.slice(2);
    const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
    let end = bytes.length;
    while (end > 0 && bytes[end - 1] === 0) end--;
    return new TextDecoder().decode(bytes.slice(0, end));
  } catch {
    return memo;
  }
}

/** Format a decoded arg value for display */
function formatArgValue(value: unknown, type: string): string {
  if (type === 'address') return formatAddress(String(value), 8);
  if (type === 'uint256' || type === 'uint128' || type === 'uint64' || type === 'int16') {
    return String(value);
  }
  if (type === 'bytes32') {
    const s = String(value);
    if (s.length > 20) return `${s.slice(0, 10)}...${s.slice(-6)}`;
    return s;
  }
  if (type === 'bool') return value ? 'Yes' : 'No';
  if (type === 'string') return String(value);
  return String(value);
}

/** Humanise an arg name: "newPolicyId" → "New Policy ID" */
function humaniseArgName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .replace(/\bId\b/g, 'ID')
    .trim();
}

function SignPage(): ReactElement {
  const { isConnected, isConnecting, address, signUp, signIn, connectInjected, hasInjectedWallet } =
    useTempo();
  const { signMessageAsync } = useSignMessage();
  const { data: walletClient } = useWalletClient();
  const { tokens } = useTokenList();
  const { preferredFeeToken } = useFeePreference();

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
  const [, setPendingAction] = useState<'sign' | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  const [tokenMeta, setTokenMeta] = useState<TokenMeta | null>(null);
  const [feeTokenMeta, setFeeTokenMeta] = useState<TokenMeta | null>(null);
  const [resolvedAddresses, setResolvedAddresses] = useState<Record<string, TokenMeta>>({});

  // Fee token selection for sign_transaction requests
  const [selectedFeeToken, setSelectedFeeToken] = useState<import('@/lib/tokenlist').Token | null>(
    null
  );

  const shouldExecuteAfterAuth = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fee token priority: dapp-provided > user on-chain preference > chain default (AlphaUSD) > first token
  useEffect(() => {
    if (!pendingRequest || requestType !== 'sign_transaction' || tokens.length === 0) return;
    if (selectedFeeToken) return; // already selected

    const request = pendingRequest.request as TransactionRequest;
    const rawParams = request.params || {};
    const params = deserializeTxFromTransport(rawParams);
    const dappFeeToken = params.feeToken as Address | undefined;

    // Dapp-provided fee token
    if (dappFeeToken) {
      const match = tokens.find(t => t.address.toLowerCase() === dappFeeToken.toLowerCase());
      if (match) {
        setSelectedFeeToken(match);
        return;
      }
    }

    // User on-chain preference
    if (preferredFeeToken) {
      const match = tokens.find(t => t.address.toLowerCase() === preferredFeeToken.toLowerCase());
      if (match) {
        setSelectedFeeToken(match);
        return;
      }
    }

    // Chain default (AlphaUSD)
    const chainDefault = tokens.find(
      t => t.address.toLowerCase() === tempoChain.feeToken.toLowerCase()
    );
    setSelectedFeeToken(chainDefault ?? tokens[0]);
  }, [pendingRequest, requestType, tokens, preferredFeeToken, selectedFeeToken]);

  // Decode any tx calldata into human-readable fields
  const decodedTx = useMemo(() => {
    if (!pendingRequest || requestType !== 'sign_transaction') return null;
    const request = pendingRequest.request as TransactionRequest;
    const rawParams = request.params || {};
    const params = deserializeTxFromTransport(rawParams);
    return tryDecodeTx(params);
  }, [pendingRequest, requestType]);

  // Fetch token metadata for the contract address (for transfers) and fee token (for all txns)
  useEffect(() => {
    if (!pendingRequest || requestType !== 'sign_transaction') {
      setTokenMeta(null);
      setFeeTokenMeta(null);
      return;
    }

    let cancelled = false;
    const request = pendingRequest.request as TransactionRequest;
    const rawParams = request.params || {};
    const params = deserializeTxFromTransport(rawParams);

    const fetchMeta = async (): Promise<void> => {
      // Fetch token metadata for the contract being called (useful for transfers + any tip20 call)
      const contractAddr = params.to as Address | undefined;
      if (contractAddr) {
        try {
          const meta = await Actions.token.getMetadata(tempoPublicClient, { token: contractAddr });
          if (!cancelled)
            setTokenMeta({ name: meta.name, symbol: meta.symbol, decimals: meta.decimals });
        } catch {
          if (!cancelled) setTokenMeta(null);
        }
      } else {
        setTokenMeta(null);
      }

      // Fetch fee token metadata
      const feeToken = params.feeToken as Address | undefined;
      if (feeToken) {
        try {
          const meta = await Actions.token.getMetadata(tempoPublicClient, { token: feeToken });
          if (!cancelled)
            setFeeTokenMeta({ name: meta.name, symbol: meta.symbol, decimals: meta.decimals });
        } catch {
          if (!cancelled) setFeeTokenMeta(null);
        }
      } else {
        setFeeTokenMeta(null);
      }
    };

    fetchMeta();
    return () => {
      cancelled = true;
    };
  }, [decodedTx, pendingRequest, requestType]);

  // Resolve address-type args (e.g. quoteToken, token) to token names
  useEffect(() => {
    if (!decodedTx) {
      setResolvedAddresses({});
      return;
    }

    const addressArgs = decodedTx.args.filter(
      a =>
        a.type === 'address' &&
        a.value &&
        String(a.value) !== '0x0000000000000000000000000000000000000000'
    );
    if (addressArgs.length === 0) return;

    let cancelled = false;

    const resolve = async (): Promise<void> => {
      const results: Record<string, TokenMeta> = {};
      await Promise.all(
        addressArgs.map(async arg => {
          try {
            const meta = await Actions.token.getMetadata(tempoPublicClient, {
              token: arg.value as Address,
            });
            if (meta.name && meta.symbol) {
              results[String(arg.value).toLowerCase()] = {
                name: meta.name,
                symbol: meta.symbol,
                decimals: meta.decimals,
              };
            }
          } catch {
            // Not a token or unreachable — skip
          }
        })
      );
      if (!cancelled) setResolvedAddresses(results);
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, [decodedTx]);

  const handleCopy = async (value: string, field: string): Promise<void> => {
    if (await copyToClipboard(value)) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  // Listen for requests
  useEffect(() => {
    const validMethods = ['sign_message', 'sign_transaction'];

    const handleMessage = (event: MessageEvent): void => {
      const parsed = parseMessage(event);
      if (!parsed) return;

      const { request, origin } = parsed;
      if (!validMethods.includes(request.method)) return;

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
    if (window.opener) {
      const openerOrigin = sourceOrigin || '*';
      window.opener.postMessage({ type: 'TEMPO_WALLET_READY', version: '1.0.0' }, openerOrigin);
    }

    return () => window.removeEventListener('message', handleMessage);
  }, [sourceOrigin]);

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

      // Permission check: both sign_message and sign_transaction need 'sign'
      if (!hasPermission(sourceOrigin, 'sign')) {
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

        case 'sign_transaction': {
          const rawParams = request.params as Record<string, unknown>;
          const params = deserializeTxFromTransport(rawParams);

          // Override fee token if user changed it in the picker
          if (selectedFeeToken && params.feeToken) {
            params.feeToken = selectedFeeToken.address;
          }

          // Already prepared by SDK — just sign
          const signedTransaction = await walletClient.signTransaction(params as any);

          if (sourceWindow) {
            sendResponse(
              sourceOrigin,
              {
                id: request.id,
                success: true,
                result: { signedTransaction },
              },
              sourceWindow
            );
          }
          break;
        }

        default:
          throw new Error(`Unsupported: ${request.method}`);
      }

      addActivity({
        type: request.method as ActivityType,
        status: 'success',
        appName: pendingRequest.appInfo.name,
        appUrl: pendingRequest.appInfo.url,
        details: request.params as Record<string, unknown>,
      });

      setStatus('success');
      window.close();
    } catch (err) {
      console.error('[Sign] Failed:', err);
      const friendlyError = getUserFriendlyError(err);
      setError(friendlyError);
      setStatus('error');

      const request = pendingRequest.request as TransactionRequest;

      addActivity({
        type: (request.method || 'sign_transaction') as ActivityType,
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
  }, [
    pendingRequest,
    sourceOrigin,
    sourceWindow,
    signMessageAsync,
    walletClient,
    address,
    selectedFeeToken,
  ]);

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
            type: (pendingRequest.request.method || 'sign_transaction') as ActivityType,
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
      type: (pendingRequest.request.method || 'sign_transaction') as ActivityType,
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
            { id: 'reconnect', success: true, result: { reconnected: true, address } },
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
      sendResponse(
        sourceOrigin,
        createErrorResponse(
          requestId,
          'User cancelled - app not connected',
          WalletConnectErrorCode.NOT_CONNECTED
        ),
        sourceWindow
      );
    }
    window.close();
  };

  const getConfig = (): RequestConfig => REQUEST_CONFIG[requestType || 'sign_transaction'];

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
            <div className="w-full">
              <div className="px-6 pt-8 pb-5 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#E07A5F]/8 flex items-center justify-center mx-auto mb-4">
                  <Link2 className="w-7 h-7 text-[#E07A5F]" />
                </div>
                <h1 className="text-[17px] font-semibold text-[#2D3436] mb-1.5">
                  App Not Connected
                </h1>
                <p className="text-[13px] text-[#9B9590] leading-relaxed">
                  This app&apos;s connection was revoked or has expired.
                </p>
              </div>
              {disconnectedAppInfo && (
                <div className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F5F2ED] flex items-center justify-center shrink-0">
                      <img src="/logo.png" alt="Temporium" className="w-6 h-6 object-contain" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-[#2D3436] truncate">
                        {disconnectedAppInfo.name}
                      </p>
                      <p className="text-[11px] text-[#9B9590] font-mono truncate">
                        {disconnectedAppInfo.url}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {isConnected && address && (
                <div className="px-6 py-4">
                  <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-widest mb-3">
                    Connecting as
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#F5F2ED] flex items-center justify-center shrink-0">
                      <Wallet className="w-4 h-4 text-[#6B6560]" />
                    </div>
                    <p className="text-[13px] font-mono font-medium text-[#2D3436] truncate">
                      {formatAddress(address, 6)}
                    </p>
                  </div>
                </div>
              )}

              <div className="px-5 py-5 flex items-center gap-2.5">
                <Button
                  variant="outline"
                  className="flex-1 h-11 rounded-xl text-[13px] border-[#EDE9E3]"
                  onClick={handleCancelNotConnected}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-[#E07A5F] hover:bg-[#D06A4F] text-white"
                  onClick={handleReconnect}
                  isLoading={isConnecting}
                >
                  {isConnected ? (
                    <>
                      <Link2 className="w-4 h-4 mr-1.5" />
                      Reconnect
                    </>
                  ) : (
                    'Sign In to Reconnect'
                  )}
                </Button>
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
          <div className="w-full">
            <div className="px-6 py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#E07A5F]/8 flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-6 h-6 text-[#E07A5F] animate-spin" />
              </div>
              <h1 className="text-[16px] font-semibold text-[#2D3436] mb-1.5">
                Waiting for Request
              </h1>
              <p className="text-[13px] text-[#9B9590] mb-6">
                Waiting for an app to request signing...
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
          <div className="w-full">
            <div className="px-6 py-10 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                className="w-16 h-16 rounded-2xl bg-[#E07A5F]/10 flex items-center justify-center mx-auto mb-4"
              >
                <CheckCircle className="w-8 h-8 text-[#E07A5F]" />
              </motion.div>
              <h1 className="text-[17px] font-semibold text-[#2D3436] mb-1.5">
                {requestType === 'sign_message' ? 'Message Signed' : 'Transaction Signed'}
              </h1>
              <p className="text-[13px] text-[#9B9590] mb-1">
                {requestType === 'sign_message'
                  ? 'Signature complete'
                  : `${config.title} signed successfully`}
              </p>
              {txHash && (
                <a
                  href={getExplorerTxUrl(txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-lg bg-[#E07A5F]/8 text-[12px] font-semibold text-[#E07A5F] hover:bg-[#E07A5F]/12 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View on Explorer
                </a>
              )}
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
          <div className="w-full">
            <div className="px-6 py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#F5F2ED] flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-7 h-7 text-[#9B9590]" />
              </div>
              <h1 className="text-[16px] font-semibold text-[#2D3436] mb-1.5">Request Rejected</h1>
              <p className="text-[13px] text-[#9B9590]">You declined the request</p>
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
          <div className="w-full">
            <div className="px-6 py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#F5F2ED] flex items-center justify-center mx-auto mb-4">
                <Clock className="w-7 h-7 text-[#9B9590]" />
              </div>
              <h1 className="text-[16px] font-semibold text-[#2D3436] mb-1.5">Request Expired</h1>
              <p className="text-[13px] text-[#9B9590]">The signing request has timed out</p>
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
          <div className="w-full">
            <div className="px-6 pt-10 pb-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-7 h-7 text-red-500" />
              </div>
              <h1 className="text-[16px] font-semibold text-[#2D3436] mb-1.5">Request Failed</h1>
              <p className="text-[13px] text-[#9B9590]">{error || 'Something went wrong'}</p>
            </div>
            <div className="px-5 pb-5 flex items-center gap-2.5">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl text-[13px] border-[#EDE9E3] text-[#6B6560]"
                onClick={() => window.close()}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-[#E07A5F] hover:bg-[#D4694F] text-white"
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
  const txParams =
    requestType === 'sign_transaction'
      ? deserializeTxFromTransport(params as Record<string, unknown>)
      : params;
  const config = REQUEST_CONFIG[requestType || 'sign_transaction'];
  const Icon = config.icon;
  const estimatedFee = (() => {
    if (requestType !== 'sign_transaction') return null;
    const gas = txParams.gas as bigint | undefined;
    const maxFeePerGas = txParams.maxFeePerGas as bigint | undefined;
    if (!gas || !maxFeePerGas) return null;
    return gas * maxFeePerGas;
  })();

  return (
    <>
      <div className="min-h-screen bg-[#FDFBF8] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-[380px]"
        >
          <div className="w-full">
            {/* Header */}
            <div className="px-6 pt-7 pb-5">
              <div className="flex items-center justify-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-2xl bg-[#F5F2ED] flex items-center justify-center overflow-hidden shrink-0">
                  {pendingRequest.appInfo.icon ? (
                    <img
                      src={pendingRequest.appInfo.icon}
                      alt=""
                      className="w-14 h-14 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-[#E07A5F]/8 flex items-center justify-center">
                      <span className="text-[18px] font-bold text-[#E07A5F]">
                        {pendingRequest.appInfo.name?.charAt(0) || '?'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <div className="w-6 h-px bg-[#EDE9E3]" />
                  <Icon className="w-4 h-4 text-[#E07A5F]" />
                  <div className="w-6 h-px bg-[#EDE9E3]" />
                </div>

                <div className="w-14 h-14 rounded-2xl bg-[#F5F2ED] flex items-center justify-center overflow-hidden shrink-0">
                  <img src="/logo.png" alt="Temporium" className="w-8 h-8 object-contain" />
                </div>
              </div>

              <div className="text-center">
                <h1 className="text-[17px] font-semibold text-[#2D3436] mb-1">
                  {decodedTx
                    ? isTransfer(decodedTx)
                      ? 'Confirm Payment'
                      : `Confirm ${decodedTx.label}`
                    : config.title}
                </h1>
                <p className="text-[12px] text-[#9B9590]">
                  {pendingRequest.appInfo.name} &middot;{' '}
                  <span className="font-mono">{pendingRequest.appInfo.url}</span>
                </p>
              </div>
            </div>

            {/* Request Details */}
            <div className="px-6 py-5">
              {requestType === 'sign_message' ? (
                <div>
                  <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-widest mb-2.5">
                    Message
                  </p>
                  <div className="bg-[#FDFBF8] rounded-xl px-4 py-3.5 max-h-36 overflow-auto">
                    <p className="text-[13px] font-mono text-[#2D3436] break-all whitespace-pre-wrap leading-relaxed">
                      {(params as { message?: string }).message || '(empty)'}
                    </p>
                  </div>
                </div>
              ) : decodedTx ? (
                /* Decoded transaction — human-readable details */
                <div className="space-y-0">
                  <DetailRow label="Type" value={decodedTx.label} />

                  {/* For transfers, show amount prominently */}
                  {isTransfer(decodedTx) && (
                    <div className="flex items-center justify-between py-2.5">
                      <span className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-widest">
                        Amount
                      </span>
                      <span className="text-[15px] font-semibold text-[#2D3436]">
                        {tokenMeta
                          ? `${formatAmount(getTransferAmount(decodedTx), tokenMeta.decimals)} ${tokenMeta.symbol}`
                          : formatAmount(getTransferAmount(decodedTx), 6)}
                      </span>
                    </div>
                  )}

                  {/* Render each decoded argument */}
                  {decodedTx.args.map(arg => {
                    // Skip amount for transfers (already shown above)
                    if (isTransfer(decodedTx) && arg.name === 'amount') return null;
                    // Format memo specially
                    if (arg.type === 'bytes32' && arg.name === 'memo') {
                      return (
                        <DetailRow
                          key={arg.name}
                          label="Memo"
                          value={decodeMemo(arg.value as `0x${string}`)}
                        />
                      );
                    }
                    // Format amount fields with token decimals when available
                    if (
                      arg.name === 'amount' &&
                      tokenMeta &&
                      (arg.type === 'uint256' || arg.type === 'uint128')
                    ) {
                      return (
                        <DetailRow
                          key={arg.name}
                          label={humaniseArgName(arg.name)}
                          value={`${formatAmount(arg.value as bigint, tokenMeta.decimals)} ${tokenMeta.symbol}`}
                        />
                      );
                    }
                    // For address args, show resolved token name if available
                    if (arg.type === 'address' && arg.value) {
                      const resolved = resolvedAddresses[String(arg.value).toLowerCase()];
                      return (
                        <DetailRow
                          key={arg.name}
                          label={humaniseArgName(arg.name)}
                          value={
                            resolved
                              ? `${resolved.name} (${resolved.symbol})`
                              : formatAddress(String(arg.value), 8)
                          }
                          copyValue={String(arg.value)}
                          onCopy={handleCopy}
                          copiedField={copiedField}
                          fieldKey={arg.name}
                        />
                      );
                    }
                    const displayValue = formatArgValue(arg.value, arg.type);
                    return (
                      <DetailRow
                        key={arg.name}
                        label={humaniseArgName(arg.name)}
                        value={displayValue}
                      />
                    );
                  })}

                  {/* Token info */}
                  {tokenMeta && (
                    <DetailRow
                      label="Token"
                      value={`${tokenMeta.name} (${tokenMeta.symbol})`}
                      copyValue={decodedTx.contractAddress}
                      onCopy={handleCopy}
                      copiedField={copiedField}
                      fieldKey="token"
                    />
                  )}

                  {/* Network fee — shown for all decoded txns */}
                  {(params.feeToken as string | undefined) && (
                    <DetailRow
                      label="Network Fee"
                      value={
                        estimatedFee && feeTokenMeta
                          ? `${formatAmount(estimatedFee, 18)} ${feeTokenMeta.symbol}`
                          : estimatedFee
                            ? formatAmount(estimatedFee, 18)
                            : feeTokenMeta
                              ? feeTokenMeta.symbol
                              : formatAddress(params.feeToken as string, 6)
                      }
                      copyValue={params.feeToken as string}
                      onCopy={handleCopy}
                      copiedField={copiedField}
                      fieldKey="feeToken"
                    />
                  )}
                </div>
              ) : (
                /* Undecodable sign_transaction — raw fallback */
                <div className="space-y-0">
                  <DetailRow label="Type" value="Transaction" />
                  {(params.to as string | undefined) && (
                    <DetailRow
                      label="To"
                      value={formatAddress(params.to as string, 8)}
                      copyValue={params.to as string}
                      onCopy={handleCopy}
                      copiedField={copiedField}
                      fieldKey="to"
                    />
                  )}
                  {(params.data as string | undefined) && (
                    <DetailRow
                      label="Data"
                      value={`${(params.data as string).slice(0, 10)}...${(params.data as string).slice(-6)}`}
                      copyValue={params.data as string}
                      onCopy={handleCopy}
                      copiedField={copiedField}
                      fieldKey="data"
                    />
                  )}
                  {(params.feeToken as string | undefined) && (
                    <DetailRow
                      label="Network Fee"
                      value={
                        estimatedFee && feeTokenMeta
                          ? `${formatAmount(estimatedFee, 18)} ${feeTokenMeta.symbol}`
                          : estimatedFee
                            ? formatAmount(estimatedFee, 18)
                            : feeTokenMeta
                              ? feeTokenMeta.symbol
                              : formatAddress(params.feeToken as string, 6)
                      }
                      copyValue={params.feeToken as string}
                      onCopy={handleCopy}
                      copiedField={copiedField}
                      fieldKey="feeToken"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Fee Token Picker — only for sign_transaction */}
            {requestType === 'sign_transaction' && tokens.length > 0 && selectedFeeToken && (
              <div className="px-6 pb-3">
                <FeeTokenPicker
                  value={selectedFeeToken}
                  tokens={tokens}
                  onChange={setSelectedFeeToken}
                />
              </div>
            )}

            {/* Signing as */}
            {isConnected && address && (
              <div className="px-6 py-5">
                <p className="text-[11px] font-semibold text-[#9B9590] uppercase tracking-widest mb-3">
                  Signing as
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#F5F2ED] flex items-center justify-center shrink-0">
                    <Wallet className="w-4 h-4 text-[#6B6560]" />
                  </div>
                  <p className="text-[13px] font-mono font-medium text-[#2D3436] truncate">
                    {formatAddress(address, 6)}
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="px-5 py-5 flex items-center gap-2.5">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl text-[13px] border-[#EDE9E3]"
                onClick={handleReject}
                disabled={status === 'processing' || isConnecting}
              >
                Reject
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl text-[13px] font-semibold bg-[#E07A5F] hover:bg-[#D06A4F] text-white"
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

            {/* Footer */}
            <div className="px-5 pb-5 space-y-3">
              {isConnected && status === 'waiting' && (
                <div className="flex items-center justify-center gap-4 text-[10px] text-[#B5B0AA]">
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

              {timeRemaining !== null && timeRemaining > 0 && (
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#B5B0AA]">
                  <Clock className="w-3 h-3" />
                  <span>
                    Expires in {Math.floor(timeRemaining / 60)}:
                    {(timeRemaining % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              )}

              <div className="flex items-start justify-center gap-2">
                <AlertTriangle className="w-3 h-3 text-[#B5B0AA] mt-0.5 shrink-0" />
                <p className="text-[11px] text-[#B5B0AA]">
                  {requestType === 'sign_message'
                    ? 'Only sign messages from apps you trust.'
                    : 'Transactions cannot be reversed once confirmed.'}
                </p>
              </div>
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
    <div className="flex items-center justify-between py-2.5">
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
              <Check className="w-3 h-3 text-[#E07A5F]" />
            ) : (
              <Copy className="w-3 h-3 text-[#B5B0AA]" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
