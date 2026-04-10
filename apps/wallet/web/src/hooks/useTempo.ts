import { useState, useCallback } from 'react';
import { useAccount, useConnect, useDisconnect, useWalletClient, useConnectors } from 'wagmi';
import { getWalletClient } from '@wagmi/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type Address, encodeFunctionData } from 'viem';
import { tempoPasskeyConnector, injectedConnector, tempoWalletConnector, wagmiConfig } from '@/lib/wagmi';
import { tempoChain, tempoPublicClient, waitForTx } from '@/lib/tempo-client';
import { stringToBytes32, Actions, getTokenBalance } from '@/lib/tempo-client';
import { DEFAULT_FEE_TOKEN_ADDRESS, TIMING } from '@/lib/constants';
import { clearAuthTokens } from '@/lib/auth-storage';
import { signInWithEthereum } from '@/lib/siwe-auth';
import type { WalletType } from '@/types';
import type {
  SendPaymentParams,
  SendScheduledPaymentParams,
  AddLiquidityParams,
  RemoveLiquidityParams,
  ApproveTokenParams,
  CreateTokenParams,
  MintTokenParams,
  BurnTokenParams,
  ClaimRewardsParams,
  AmmSwapParams,
  BatchSendParams,
} from '@temporium/wallet-connect';

/**
 * Encode a memo string to bytes
 */
export function encodeMemo(memo: string): `0x${string}` {
  if (!memo) return '0x';
  return stringToBytes32(memo);
}

/**
 * Decode a memo from bytes
 */
export function decodeMemo(hex: `0x${string}`): string {
  if (!hex || hex === '0x') return '';
  const bytes = new Uint8Array(
    (hex.slice(2).match(/.{1,2}/g) || []).map(byte => parseInt(byte, 16))
  );
  return new TextDecoder().decode(bytes).replace(/\0+$/, '');
}

interface UseTempoReturn {
  isConnected: boolean;
  isConnecting: boolean;
  address: Address | undefined;
  error: Error | null;
  walletType: WalletType;
  hasInjectedWallet: boolean;
  // Auth
  signUp: (label?: string) => Promise<void>;
  signIn: () => Promise<void>;
  connectInjected: () => Promise<void>;
  connectTempoWallet: () => Promise<void>;
  disconnect: () => Promise<void>;
  // Transactions
  sendPayment: (params: SendPaymentParams) => Promise<string>;
  signScheduledPayment: (
    params: SendScheduledPaymentParams
  ) => Promise<{ serializedTransaction: string; scheduledFor: number }>;
  submitSignedTransaction: (serializedTransaction: string) => Promise<string>;
  addLiquidity: (params: AddLiquidityParams) => Promise<string>;
  removeLiquidity: (params: RemoveLiquidityParams) => Promise<string>;
  ammSwap: (params: AmmSwapParams) => Promise<string>;
  approveToken: (params: ApproveTokenParams) => Promise<string>;
  createToken: (params: CreateTokenParams) => Promise<{ hash: string; tokenAddress: Address }>;
  mintToken: (params: MintTokenParams) => Promise<string>;
  burnToken: (params: BurnTokenParams) => Promise<string>;
  claimRewards: (params: ClaimRewardsParams) => Promise<string>;
  batchSend: (params: BatchSendParams) => Promise<string>;
  // Utilities
  encodeMemo: typeof encodeMemo;
  decodeMemo: typeof decodeMemo;
}

/**
 * Main hook — wraps passkey and injected wallet types
 *
 * Uses wagmi walletClient → Actions.* calls
 */
export function useTempo(): UseTempoReturn {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Wagmi hooks
  const { address, isConnected, connector } = useAccount();
  const { connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { data: walletClient } = useWalletClient();
  const connectors = useConnectors();
  const queryClient = useQueryClient();

  const hasInjectedWallet = connectors.some(c => c.type === 'injected');

  // Determine wallet type
  const walletType: WalletType = isConnected
    ? connector?.id === 'xyz.tempo.wallet'
      ? 'tempo'
      : connector?.type === 'injected'
        ? 'injected'
        : 'passkey'
    : null;

  const signUp = useCallback(
    async (label?: string) => {
      setIsConnecting(true);
      setError(null);
      try {
        const passkeyLabel = label ? `Temporium: ${label}` : 'Temporium Wallet';
        await connectAsync({
          connector: tempoPasskeyConnector,
          capabilities: { type: 'sign-up', label: passkeyLabel },
        });
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsConnecting(false);
      }
    },
    [connectAsync]
  );

  const signIn = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      await connectAsync({
        connector: tempoPasskeyConnector,
        capabilities: { type: 'sign-in', selectAccount: true },
      });
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [connectAsync]);

  const connectInjected = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const result = await connectAsync({
        connector: injectedConnector,
        chainId: tempoChain.id,
      });

      const client = await getWalletClient(wagmiConfig, {
        account: result.accounts[0],
        chainId: tempoChain.id,
      });

      if (!client) throw new Error('Failed to get wallet client after connection');

      await signInWithEthereum(client);
    } catch (err) {
      setError(err as Error);
      try {
        await disconnectAsync();
      } catch {
        /* ignore */
      }
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [connectAsync, disconnectAsync]);

  const connectTempoWallet = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const result = await connectAsync({
        connector: tempoWalletConnector,
        chainId: tempoChain.id,
      });

      const client = await getWalletClient(wagmiConfig, {
        account: result.accounts[0],
        chainId: tempoChain.id,
      });

      if (!client) throw new Error('Failed to get wallet client after connection');

      await signInWithEthereum(client);
    } catch (err) {
      setError(err as Error);
      try {
        await disconnectAsync();
      } catch {
        /* ignore */
      }
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [connectAsync, disconnectAsync]);

  const disconnect = useCallback(async () => {
    clearAuthTokens();
    queryClient.clear();
    if (isConnected) {
      await disconnectAsync();
    }
  }, [disconnectAsync, queryClient, isConnected]);

  // ============================================================================
  // Transaction helpers
  // ============================================================================

  const ensureClient = useCallback(() => {
    if (!walletClient || !address) throw new Error('Not connected');
    return { walletClient, address };
  }, [walletClient, address]);

  // ---------- Token ----------

  const sendPayment = useCallback(
    async (params: SendPaymentParams) => {
      const { walletClient: client } = ensureClient();
      return Actions.token.transfer(client, {
        token: params.token,
        to: params.to,
        amount: params.amount,
        memo: params.memo,
        feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
      });
    },
    [ensureClient]
  );

  const signScheduledPayment = useCallback(
    async (params: SendScheduledPaymentParams) => {
      const now = Math.floor(Date.now() / 1000);
      if (params.scheduledFor <= now) throw new Error('Scheduled time must be in the future');
      const { walletClient: client } = ensureClient();

      // Build the call data using the SDK helper
      const call = Actions.token.transfer.call({
        token: params.token,
        to: params.to,
        amount: params.amount,
        memo: params.memo,
      });

      const data = encodeFunctionData({
        abi: call.abi,
        functionName: call.functionName,
        args: call.args,
      });

      // Tempo uses a 2D nonce system (nonceKey + nonce). By assigning a random
      // nonceKey we place this scheduled tx in its own nonce lane (nonce=0) so it
      // never conflicts with any other transaction the user sends.
      const randomBytes = crypto.getRandomValues(new Uint8Array(6));
      const nonceKey = BigInt(
        '0x' +
          Array.from(randomBytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
      );

      // Prepare the request WITHOUT validAfter so gas estimation succeeds
      // (estimateGas simulates at the current block timestamp, which is before
      // the scheduled validAfter — causing a "transaction not valid yet" error).
      const prepared = await client.prepareTransactionRequest({
        to: call.address,
        data,
        feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
        nonceKey,
        nonce: 0,
      } as any);

      // Now add validAfter to the prepared request before signing.
      const withValidAfter = { ...prepared, validAfter: params.scheduledFor };

      // Sign the prepared transaction — does NOT submit to the network.
      const serializedTransaction = await client.signTransaction(withValidAfter as any);

      return { serializedTransaction, scheduledFor: params.scheduledFor };
    },
    [ensureClient]
  );

  const submitSignedTransaction = useCallback(async (serializedTransaction: string) => {
    return tempoPublicClient.sendRawTransaction({
      serializedTransaction: serializedTransaction as `0x${string}`,
    });
  }, []);

  const approveToken = useCallback(
    async (params: ApproveTokenParams) => {
      const { walletClient: client } = ensureClient();
      return Actions.token.approve(client, {
        token: params.token,
        spender: params.spender,
        amount: params.amount,
        feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
      });
    },
    [ensureClient]
  );

  const createToken = useCallback(
    async (params: CreateTokenParams) => {
      const { walletClient: client } = ensureClient();
      const result = await Actions.token.createSync(client, {
        name: params.name,
        symbol: params.symbol,
        currency: params.currency,
        admin: params.admin,
        quoteToken: params.quoteToken,
        salt: params.salt,
      });
      return { hash: result.receipt.transactionHash, tokenAddress: result.token as Address };
    },
    [ensureClient]
  );

  const mintToken = useCallback(
    async (params: MintTokenParams) => {
      const { walletClient: client } = ensureClient();
      return Actions.token.mint(client, {
        token: params.token,
        to: params.to,
        amount: params.amount,
        memo: params.memo,
        feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
      });
    },
    [ensureClient]
  );

  const burnToken = useCallback(
    async (params: BurnTokenParams) => {
      const { walletClient: client } = ensureClient();
      return Actions.token.burn(client, {
        token: params.token,
        amount: params.amount,
        memo: params.memo,
        feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
      });
    },
    [ensureClient]
  );

  // ---------- AMM ----------

  const ammSwap = useCallback(
    async (params: AmmSwapParams) => {
      const { walletClient: client, address: sender } = ensureClient();
      return Actions.amm.rebalanceSwap(client, {
        userToken: params.userToken,
        validatorToken: params.validatorToken,
        amountOut: params.amountOut,
        to: sender,
        feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
      });
    },
    [ensureClient]
  );

  const addLiquidity = useCallback(
    async (params: AddLiquidityParams) => {
      const { walletClient: client, address: sender } = ensureClient();
      return Actions.amm.mint(client, {
        userTokenAddress: params.userTokenAddress,
        validatorTokenAddress: params.validatorTokenAddress,
        validatorTokenAmount: params.validatorTokenAmount,
        to: sender,
        feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
      });
    },
    [ensureClient]
  );

  const removeLiquidity = useCallback(
    async (params: RemoveLiquidityParams) => {
      const { walletClient: client, address: sender } = ensureClient();
      return Actions.amm.burn(client, {
        userToken: params.userTokenAddress,
        validatorToken: params.validatorTokenAddress,
        liquidity: params.liquidity,
        to: sender,
        feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
      });
    },
    [ensureClient]
  );

  // ---------- Batch Send ----------

  const batchSend = useCallback(
    async (params: BatchSendParams): Promise<string> => {
      const { walletClient: client } = ensureClient();
      const calls = params.transfers.map(transfer =>
        Actions.token.transfer.call({
          token: params.token,
          to: transfer.to,
          amount: transfer.amount,
          memo: transfer.memo,
        })
      );
      const result = await client.sendCalls({
        calls,
        feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
      } as any);
      // result.id is a composite: txHash (32 bytes) + chainId + magic
      // Extract the actual tx hash (first 66 hex chars)
      const id: string = result.id;
      const txHash = (id.length > 66 ? id.slice(0, 66) : id) as `0x${string}`;
      await waitForTx(txHash);
      return txHash;
    },
    [ensureClient]
  );

  // ---------- Rewards ----------

  const claimRewards = useCallback(
    async (params: ClaimRewardsParams) => {
      const { walletClient: client } = ensureClient();
      return Actions.reward.claim(client, {
        token: params.token,
        feeToken: params.feeToken || DEFAULT_FEE_TOKEN_ADDRESS,
      });
    },
    [ensureClient]
  );

  return {
    isConnected,
    isConnecting,
    address,
    error,
    walletType,
    hasInjectedWallet,
    signUp,
    signIn,
    connectInjected,
    connectTempoWallet,
    disconnect,
    sendPayment,
    signScheduledPayment,
    submitSignedTransaction,
    addLiquidity,
    removeLiquidity,
    ammSwap,
    approveToken,
    createToken,
    mintToken,
    burnToken,
    claimRewards,
    batchSend,
    encodeMemo,
    decodeMemo,
  };
}

interface UseTokenBalanceReturn {
  data: { value: bigint };
  isLoading: boolean;
}

export function useTokenBalance(
  token: Address | undefined,
  account?: Address
): UseTokenBalanceReturn {
  const { address: wagmiAddress } = useAccount();
  const address = account || wagmiAddress;

  const { data, isLoading } = useQuery({
    queryKey: ['tokenBalance', token, address],
    queryFn: () => getTokenBalance(token!, address!),
    enabled: !!address && !!token,
    refetchInterval: TIMING.BALANCE_REFRESH_MS,
    staleTime: 5000,
  });

  return { data: { value: data ?? 0n }, isLoading };
}
