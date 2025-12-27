import { useState, useCallback } from 'react';
import { useAccount, useConnect, useDisconnect, useWalletClient, useConnectors } from 'wagmi';
import { getWalletClient } from '@wagmi/core';
import { useQueryClient } from '@tanstack/react-query';
import { type Address } from 'viem';
import { Hooks } from 'tempo.ts/wagmi';
import { tempoPasskeyConnector, injectedConnector, wagmiConfig } from '@/lib/wagmi';
import { tempoChain } from '@/lib/tempo-client';
import { stringToBytes32, Actions } from '@/lib/tempo-client';
import { DEFAULT_FEE_TOKEN_ADDRESS, MAX_SCHEDULE_SECONDS, TIMING } from '@/lib/constants';
import { clearAuthTokens } from '@/lib/auth-storage';
import { signInWithEthereum } from '@/lib/siwe-auth';

/** Type of wallet connection */
export type WalletType = 'passkey' | 'injected' | null;

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

/**
 * Parameters for sending a payment
 */
export interface SendPaymentParams {
  to: Address;
  amount: bigint;
  token?: Address;
  feeToken?: Address;
  memo?: string;
}

/**
 * Parameters for sending a scheduled payment
 */
export interface SendScheduledPaymentParams extends SendPaymentParams {
  scheduledFor: number; // Unix timestamp (seconds) when the transaction should execute
}

/**
 * Parameters for swapping tokens
 */
export interface SwapParams {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  minAmountOut: bigint;
  feeToken?: Address;
}

/**
 * Parameters for adding liquidity
 */
export interface AddLiquidityParams {
  userToken: Address;
  validatorToken: Address;
  validatorTokenAmount: bigint;
  feeToken?: Address;
}

/**
 * Parameters for removing liquidity
 */
export interface RemoveLiquidityParams {
  userToken: Address;
  validatorToken: Address;
  liquidity: bigint;
  feeToken?: Address;
}

interface UseTempoReturn {
  isConnected: boolean;
  isConnecting: boolean;
  address: Address | undefined;
  error: Error | null;
  /** Type of current wallet connection */
  walletType: WalletType;
  /** True if an injected wallet (MetaMask, etc.) is available */
  hasInjectedWallet: boolean;
  signUp: (label?: string) => Promise<void>;
  signIn: () => Promise<void>;
  /** Connect with an injected wallet (MetaMask, etc.) */
  connectInjected: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendPayment: (params: SendPaymentParams) => Promise<string>;
  sendScheduledPayment: (params: SendScheduledPaymentParams) => Promise<string>;
  swapTokens: (params: SwapParams) => Promise<string>;
  addLiquidity: (params: AddLiquidityParams) => Promise<string>;
  removeLiquidity: (params: RemoveLiquidityParams) => Promise<string>;
  encodeMemo: typeof encodeMemo;
  decodeMemo: typeof decodeMemo;
}

/**
 * Main Tempo hook - wraps all tempo.ts functionality
 *
 * @example
 * ```tsx
 * const {
 *   isConnected,
 *   address,
 *   signUp,
 *   signIn,
 *   sendPayment,
 * } = useTempo()
 * ```
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

  // Detect if user has an injected wallet available
  const hasInjectedWallet = connectors.some(c => c.type === 'injected');

  // Determine wallet type based on current connector
  const walletType: WalletType = isConnected
    ? connector?.type === 'injected'
      ? 'injected'
      : 'passkey'
    : null;

  /**
   * Sign up with a new passkey (creates wallet)
   * @param label - Optional label for the passkey (will be prefixed with "Temporium: ")
   */
  const signUp = useCallback(
    async (label?: string) => {
      setIsConnecting(true);
      setError(null);
      try {
        // Generate passkey label with Temporium prefix
        const passkeyLabel = label ? `Temporium: ${label}` : 'Temporium Wallet';

        // Pass capabilities through wagmi connect - tempo.ts connector handles this
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

  /**
   * Sign in with existing passkey
   */
  const signIn = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      // Pass capabilities through wagmi connect - tempo.ts connector handles this
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

  /**
   * Connect with an injected wallet (MetaMask, Brave, etc.)
   * Includes SIWE authentication to get JWT token
   */
  const connectInjected = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      // 1. Connect wallet (switches/adds network automatically)
      const result = await connectAsync({
        connector: injectedConnector,
        chainId: tempoChain.id,
      });

      // 2. Get wallet client for signing using wagmi action
      const client = await getWalletClient(wagmiConfig, {
        account: result.accounts[0],
        chainId: tempoChain.id,
      });

      if (!client) {
        throw new Error('Failed to get wallet client after connection');
      }

      // 3. SIWE authentication to get JWT
      await signInWithEthereum(client);
    } catch (err) {
      setError(err as Error);
      // If SIWE fails, disconnect the wallet
      try {
        await disconnectAsync();
      } catch {
        // Ignore disconnect errors
      }
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [connectAsync, disconnectAsync]);

  /**
   * Disconnect wallet and clear auth tokens
   */
  const disconnect = useCallback(async () => {
    // Clear JWT tokens
    clearAuthTokens();
    // Clear all cached queries
    queryClient.clear();
    // Disconnect wallet
    await disconnectAsync();
  }, [disconnectAsync, queryClient]);

  /**
   * Send an immediate payment using tempo.ts SDK
   */
  const sendPayment = useCallback(
    async ({
      to,
      amount,
      token = DEFAULT_FEE_TOKEN_ADDRESS,
      feeToken = DEFAULT_FEE_TOKEN_ADDRESS,
      memo,
    }: SendPaymentParams) => {
      if (!walletClient || !address) {
        throw new Error('Not connected');
      }

      // Convert memo to bytes32 if provided
      const memoHex = memo ? stringToBytes32(memo) : undefined;

      // Use tempo.ts SDK's transfer action
      const hash = await Actions.token.transfer(walletClient, {
        token,
        to,
        amount,
        memo: memoHex,
        feeToken,
      });

      return hash;
    },
    [walletClient, address]
  );

  /**
   * Send a scheduled payment using tempo.ts SDK with validAfter
   * The transaction is submitted immediately but will only execute after scheduledFor time
   */
  const sendScheduledPayment = useCallback(
    async ({
      to,
      amount,
      token = DEFAULT_FEE_TOKEN_ADDRESS,
      feeToken = DEFAULT_FEE_TOKEN_ADDRESS,
      memo,
      scheduledFor,
    }: SendScheduledPaymentParams) => {
      if (!walletClient || !address) {
        throw new Error('Not connected');
      }

      // Validate scheduledFor is in the future
      const now = Math.floor(Date.now() / 1000);
      if (scheduledFor <= now) {
        throw new Error('Scheduled time must be in the future');
      }

      // Validate scheduledFor is within testnet limit (60 minutes)
      const maxTime = now + MAX_SCHEDULE_SECONDS;
      if (scheduledFor > maxTime) {
        throw new Error('Cannot schedule more than 60 minutes in advance on testnet');
      }

      // Convert memo to bytes32 if provided
      const memoHex = memo ? stringToBytes32(memo) : undefined;

      // Use tempo.ts SDK's transfer action with validAfter
      const hash = await Actions.token.transfer(walletClient, {
        token,
        to,
        amount,
        memo: memoHex,
        feeToken,
        validAfter: scheduledFor,
      });

      return hash;
    },
    [walletClient, address]
  );

  /**
   * Swap tokens using Tempo DEX
   */
  const swapTokens = useCallback(
    async ({
      tokenIn,
      tokenOut,
      amountIn,
      minAmountOut,
      feeToken = DEFAULT_FEE_TOKEN_ADDRESS,
    }: SwapParams) => {
      if (!walletClient || !address) {
        throw new Error('Not connected');
      }

      // Use tempo.ts SDK's sell action (swap exact amount in)
      const hash = await Actions.dex.sell(walletClient, {
        tokenIn,
        tokenOut,
        amountIn,
        minAmountOut,
        feeToken,
      });

      return hash;
    },
    [walletClient, address]
  );

  /**
   * Add liquidity to a pool
   */
  const addLiquidity = useCallback(
    async ({
      userToken,
      validatorToken,
      validatorTokenAmount,
      feeToken = DEFAULT_FEE_TOKEN_ADDRESS,
    }: AddLiquidityParams) => {
      if (!walletClient || !address) {
        throw new Error('Not connected');
      }

      // Use tempo.ts SDK's AMM mint action
      const hash = await Actions.amm.mint(walletClient, {
        userTokenAddress: userToken,
        validatorTokenAddress: validatorToken,
        validatorTokenAmount,
        to: address,
        feeToken,
      });

      return hash;
    },
    [walletClient, address]
  );

  /**
   * Remove liquidity from a pool
   */
  const removeLiquidity = useCallback(
    async ({
      userToken,
      validatorToken,
      liquidity,
      feeToken = DEFAULT_FEE_TOKEN_ADDRESS,
    }: RemoveLiquidityParams) => {
      if (!walletClient || !address) {
        throw new Error('Not connected');
      }

      // Use tempo.ts SDK's AMM burn action
      const hash = await Actions.amm.burn(walletClient, {
        userToken,
        validatorToken,
        liquidity,
        to: address,
        feeToken,
      });

      return hash;
    },
    [walletClient, address]
  );

  return {
    // Connection state
    isConnected,
    isConnecting,
    address,
    error,
    walletType,
    hasInjectedWallet,

    // Auth actions
    signUp,
    signIn,
    connectInjected,
    disconnect,

    // Payment actions
    sendPayment,
    sendScheduledPayment,
    swapTokens,

    // AMM actions
    addLiquidity,
    removeLiquidity,

    // Utilities
    encodeMemo,
    decodeMemo,
  };
}

interface UseTokenBalanceReturn {
  data: { value: bigint };
  isLoading: boolean;
}

/**
 * Hook to get balance for a specific token
 * Uses tempo.ts/wagmi hook with React Query for caching and auto-refresh
 */
export function useTokenBalance(token: Address | undefined): UseTokenBalanceReturn {
  const { address } = useAccount();

  const { data, isLoading } = Hooks.token.useGetBalance({
    token,
    account: address,
    query: {
      enabled: !!address && !!token,
      refetchInterval: TIMING.BALANCE_REFRESH_MS,
    },
  });

  return { data: { value: data ?? 0n }, isLoading };
}
