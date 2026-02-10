import { useState, useCallback, useRef, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useWalletClient, useConnectors } from 'wagmi';
import { getWalletClient } from '@wagmi/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type Address } from 'viem';
import { tempoPasskeyConnector, injectedConnector, wagmiConfig } from '@/lib/wagmi';
import { tempoChain } from '@/lib/tempo-client';
import { stringToBytes32, Actions, getTokenBalance } from '@/lib/tempo-client';
import { DEFAULT_FEE_TOKEN_ADDRESS, MAX_SCHEDULE_SECONDS, TIMING } from '@/lib/constants';
import { clearAuthTokens } from '@/lib/auth-storage';
import { signInWithEthereum } from '@/lib/siwe-auth';
import { getWalletConnect, destroyWalletConnect } from '@/lib/wallet-connect-client';
import type { WalletType } from '@/types';

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

export interface SendPaymentParams {
  to: Address;
  amount: bigint;
  token?: Address;
  feeToken?: Address;
  memo?: string;
}

export interface SendScheduledPaymentParams extends SendPaymentParams {
  scheduledFor: number;
}

export interface SwapParams {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  minAmountOut: bigint;
  feeToken?: Address;
}

export interface AddLiquidityParams {
  userToken: Address;
  validatorToken: Address;
  validatorTokenAmount: bigint;
  feeToken?: Address;
}

export interface RemoveLiquidityParams {
  userToken: Address;
  validatorToken: Address;
  liquidity: bigint;
  feeToken?: Address;
}

export interface BuyTokensParams {
  tokenIn: Address;
  tokenOut: Address;
  amountOut: bigint;
  maxAmountIn: bigint;
  feeToken?: Address;
}

export interface PlaceOrderParams {
  token: Address;
  amount: bigint;
  tick: number;
  type: 'buy' | 'sell';
  feeToken?: Address;
}

export interface CancelOrderParams {
  orderId: bigint;
  feeToken?: Address;
}

export interface CreatePairParams {
  base: Address;
  feeToken?: Address;
}

export interface ApproveTokenParams {
  token: Address;
  spender: Address;
  amount: bigint;
  feeToken?: Address;
}

export interface CreateTokenParams {
  name: string;
  symbol: string;
  currency: string;
  admin?: Address;
  quoteToken?: Address;
  salt?: `0x${string}`;
}

export interface MintTokenParams {
  token: Address;
  to: Address;
  amount: bigint;
  memo?: `0x${string}`;
  feeToken?: Address;
}

export interface BurnTokenParams {
  token: Address;
  amount: bigint;
  memo?: `0x${string}`;
  feeToken?: Address;
}

export interface ClaimRewardsParams {
  token: Address;
  feeToken?: Address;
}

export interface DexWithdrawParams {
  token: Address;
  amount: bigint;
  feeToken?: Address;
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
  connectWallet: () => Promise<void>;
  disconnect: () => Promise<void>;
  // Transactions
  sendPayment: (params: SendPaymentParams) => Promise<string>;
  sendScheduledPayment: (params: SendScheduledPaymentParams) => Promise<string>;
  swapTokens: (params: SwapParams) => Promise<string>;
  addLiquidity: (params: AddLiquidityParams) => Promise<string>;
  removeLiquidity: (params: RemoveLiquidityParams) => Promise<string>;
  buyTokens: (params: BuyTokensParams) => Promise<string>;
  placeOrder: (params: PlaceOrderParams) => Promise<string>;
  cancelOrder: (params: CancelOrderParams) => Promise<string>;
  createPair: (params: CreatePairParams) => Promise<string>;
  approveToken: (params: ApproveTokenParams) => Promise<string>;
  createToken: (params: CreateTokenParams) => Promise<string>;
  mintToken: (params: MintTokenParams) => Promise<string>;
  burnToken: (params: BurnTokenParams) => Promise<string>;
  claimRewards: (params: ClaimRewardsParams) => Promise<string>;
  dexWithdraw: (params: DexWithdrawParams) => Promise<string>;
  // Utilities
  encodeMemo: typeof encodeMemo;
  decodeMemo: typeof decodeMemo;
}

/**
 * Main hook — wraps all wallet types (passkey, injected, wallet-connect)
 *
 * For passkey/injected: uses wagmi walletClient → Actions.* calls
 * For wallet-connect: uses @temporium/wallet-connect SDK → popup wallet
 */
export function useTempo(): UseTempoReturn {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // WalletConnect state (separate from wagmi)
  const [wcConnected, setWcConnected] = useState(false);
  const [wcAddress, setWcAddress] = useState<Address | null>(null);
  const walletTypeRef = useRef<WalletType>(null);

  // Wagmi hooks
  const { address: wagmiAddress, isConnected: wagmiConnected, connector } = useAccount();
  const { connectAsync } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const { data: walletClient } = useWalletClient();
  const connectors = useConnectors();
  const queryClient = useQueryClient();

  const hasInjectedWallet = connectors.some(c => c.type === 'injected');

  // Restore WalletConnect state on mount
  useEffect(() => {
    const wc = getWalletConnect();
    if (wc.isConnected() && wc.getAddress()) {
      setWcConnected(true);
      setWcAddress(wc.getAddress());
      walletTypeRef.current = 'wallet-connect';
    }
  }, []);

  // Determine effective connection state
  const isConnected = wagmiConnected || wcConnected;
  const address = wagmiConnected ? wagmiAddress : wcAddress || undefined;

  // Determine wallet type
  const walletType: WalletType = wagmiConnected
    ? connector?.type === 'injected'
      ? 'injected'
      : 'passkey'
    : wcConnected
      ? 'wallet-connect'
      : null;

  // Keep ref in sync
  walletTypeRef.current = walletType;

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
      try { await disconnectAsync(); } catch { /* ignore */ }
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [connectAsync, disconnectAsync]);

  const connectWallet = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const wc = getWalletConnect();
      const result = await wc.connect({ force: true });
      setWcConnected(true);
      setWcAddress(result.address);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    clearAuthTokens();
    queryClient.clear();

    if (wcConnected) {
      const wc = getWalletConnect();
      wc.disconnect();
      destroyWalletConnect();
      setWcConnected(false);
      setWcAddress(null);
    }

    if (wagmiConnected) {
      await disconnectAsync();
    }
  }, [disconnectAsync, queryClient, wcConnected, wagmiConnected]);

  // ============================================================================
  // Transaction helpers — route to wagmi or WalletConnect based on wallet type
  // ============================================================================

  const sendPayment = useCallback(
    async ({ to, amount, token = DEFAULT_FEE_TOKEN_ADDRESS, feeToken = DEFAULT_FEE_TOKEN_ADDRESS, memo }: SendPaymentParams) => {
      if (walletTypeRef.current === 'wallet-connect') {
        const wc = getWalletConnect();
        const result = await wc.sendPayment({ to, amount, token, feeToken, memo });
        return result.hash;
      }
      if (!walletClient || !address) throw new Error('Not connected');
      const memoHex = memo ? stringToBytes32(memo) : undefined;
      return Actions.token.transfer(walletClient, { token, to, amount, memo: memoHex, feeToken });
    },
    [walletClient, address]
  );

  const sendScheduledPayment = useCallback(
    async ({ to, amount, token = DEFAULT_FEE_TOKEN_ADDRESS, feeToken = DEFAULT_FEE_TOKEN_ADDRESS, memo, scheduledFor }: SendScheduledPaymentParams) => {
      if (walletTypeRef.current === 'wallet-connect') {
        const wc = getWalletConnect();
        const result = await wc.sendScheduledPayment({ to, amount, token, feeToken, memo, scheduledFor });
        return result.hash;
      }
      if (!walletClient || !address) throw new Error('Not connected');
      const now = Math.floor(Date.now() / 1000);
      if (scheduledFor <= now) throw new Error('Scheduled time must be in the future');
      if (scheduledFor > now + MAX_SCHEDULE_SECONDS) throw new Error('Cannot schedule more than 60 minutes in advance on testnet');
      const memoHex = memo ? stringToBytes32(memo) : undefined;
      return Actions.token.transfer(walletClient, { token, to, amount, memo: memoHex, feeToken, validAfter: scheduledFor });
    },
    [walletClient, address]
  );

  const swapTokens = useCallback(
    async ({ tokenIn, tokenOut, amountIn, minAmountOut, feeToken = DEFAULT_FEE_TOKEN_ADDRESS }: SwapParams) => {
      if (walletTypeRef.current === 'wallet-connect') {
        const wc = getWalletConnect();
        const result = await wc.swapTokens({ tokenIn, tokenOut, amountIn, minAmountOut, feeToken });
        return result.hash;
      }
      if (!walletClient || !address) throw new Error('Not connected');
      return Actions.dex.sell(walletClient, { tokenIn, tokenOut, amountIn, minAmountOut, feeToken });
    },
    [walletClient, address]
  );

  const addLiquidity = useCallback(
    async ({ userToken, validatorToken, validatorTokenAmount, feeToken = DEFAULT_FEE_TOKEN_ADDRESS }: AddLiquidityParams) => {
      if (walletTypeRef.current === 'wallet-connect') {
        const wc = getWalletConnect();
        const result = await wc.addLiquidity({ userToken, validatorToken, validatorTokenAmount, feeToken });
        return result.hash;
      }
      if (!walletClient || !address) throw new Error('Not connected');
      return Actions.amm.mint(walletClient, { userTokenAddress: userToken, validatorTokenAddress: validatorToken, validatorTokenAmount, to: address, feeToken });
    },
    [walletClient, address]
  );

  const removeLiquidity = useCallback(
    async ({ userToken, validatorToken, liquidity, feeToken = DEFAULT_FEE_TOKEN_ADDRESS }: RemoveLiquidityParams) => {
      if (walletTypeRef.current === 'wallet-connect') {
        const wc = getWalletConnect();
        const result = await wc.removeLiquidity({ userToken, validatorToken, liquidity, feeToken });
        return result.hash;
      }
      if (!walletClient || !address) throw new Error('Not connected');
      return Actions.amm.burn(walletClient, { userToken, validatorToken, liquidity, to: address, feeToken });
    },
    [walletClient, address]
  );

  const buyTokens = useCallback(
    async ({ tokenIn, tokenOut, amountOut, maxAmountIn, feeToken = DEFAULT_FEE_TOKEN_ADDRESS }: BuyTokensParams) => {
      if (walletTypeRef.current === 'wallet-connect') {
        const wc = getWalletConnect();
        const result = await wc.buyTokens({ tokenIn, tokenOut, amountOut, maxAmountIn, feeToken });
        return result.hash;
      }
      if (!walletClient || !address) throw new Error('Not connected');
      return Actions.dex.buy(walletClient, { tokenIn, tokenOut, amountOut, maxAmountIn, feeToken });
    },
    [walletClient, address]
  );

  const placeOrder = useCallback(
    async ({ token, amount, tick, type, feeToken = DEFAULT_FEE_TOKEN_ADDRESS }: PlaceOrderParams) => {
      if (walletTypeRef.current === 'wallet-connect') {
        const wc = getWalletConnect();
        const result = await wc.placeOrder({ token, amount, tick, type, feeToken });
        return result.hash;
      }
      if (!walletClient || !address) throw new Error('Not connected');
      return Actions.dex.place(walletClient, { token, amount, tick, type, feeToken });
    },
    [walletClient, address]
  );

  const cancelOrder = useCallback(
    async ({ orderId, feeToken = DEFAULT_FEE_TOKEN_ADDRESS }: CancelOrderParams) => {
      if (walletTypeRef.current === 'wallet-connect') {
        const wc = getWalletConnect();
        const result = await wc.cancelOrder({ orderId, feeToken });
        return result.hash;
      }
      if (!walletClient || !address) throw new Error('Not connected');
      return Actions.dex.cancel(walletClient, { orderId, feeToken });
    },
    [walletClient, address]
  );

  const createPair = useCallback(
    async ({ base, feeToken = DEFAULT_FEE_TOKEN_ADDRESS }: CreatePairParams) => {
      if (walletTypeRef.current === 'wallet-connect') {
        const wc = getWalletConnect();
        const result = await wc.createPair({ base, feeToken });
        return result.hash;
      }
      if (!walletClient || !address) throw new Error('Not connected');
      return Actions.dex.createPair(walletClient, { base, feeToken });
    },
    [walletClient, address]
  );

  const approveToken = useCallback(
    async ({ token, spender, amount, feeToken = DEFAULT_FEE_TOKEN_ADDRESS }: ApproveTokenParams) => {
      if (walletTypeRef.current === 'wallet-connect') {
        const wc = getWalletConnect();
        const result = await wc.approveToken({ token, spender, amount, feeToken });
        return result.hash;
      }
      if (!walletClient || !address) throw new Error('Not connected');
      return Actions.token.approve(walletClient, { token, spender, amount, feeToken });
    },
    [walletClient, address]
  );

  const createToken = useCallback(
    async ({ name, symbol, currency, admin, quoteToken, salt }: CreateTokenParams) => {
      if (walletTypeRef.current === 'wallet-connect') {
        const wc = getWalletConnect();
        const result = await wc.createToken({ name, symbol, currency, admin, quoteToken, salt });
        return result.hash;
      }
      if (!walletClient || !address) throw new Error('Not connected');
      return Actions.token.create(walletClient, { name, symbol, currency, admin, quoteToken, salt });
    },
    [walletClient, address]
  );

  const mintToken = useCallback(
    async ({ token, to, amount, memo, feeToken = DEFAULT_FEE_TOKEN_ADDRESS }: MintTokenParams) => {
      if (walletTypeRef.current === 'wallet-connect') {
        const wc = getWalletConnect();
        const result = await wc.mintToken({ token, to, amount, memo, feeToken });
        return result.hash;
      }
      if (!walletClient || !address) throw new Error('Not connected');
      return Actions.token.mint(walletClient, { token, to, amount, memo, feeToken });
    },
    [walletClient, address]
  );

  const burnToken = useCallback(
    async ({ token, amount, memo, feeToken = DEFAULT_FEE_TOKEN_ADDRESS }: BurnTokenParams) => {
      if (walletTypeRef.current === 'wallet-connect') {
        const wc = getWalletConnect();
        const result = await wc.burnToken({ token, amount, memo, feeToken });
        return result.hash;
      }
      if (!walletClient || !address) throw new Error('Not connected');
      return Actions.token.burn(walletClient, { token, amount, memo, feeToken });
    },
    [walletClient, address]
  );

  const claimRewards = useCallback(
    async ({ token, feeToken = DEFAULT_FEE_TOKEN_ADDRESS }: ClaimRewardsParams) => {
      if (walletTypeRef.current === 'wallet-connect') {
        const wc = getWalletConnect();
        const result = await wc.claimRewards({ token, feeToken });
        return result.hash;
      }
      if (!walletClient || !address) throw new Error('Not connected');
      return Actions.reward.claim(walletClient, { token, feeToken });
    },
    [walletClient, address]
  );

  const dexWithdraw = useCallback(
    async ({ token, amount, feeToken = DEFAULT_FEE_TOKEN_ADDRESS }: DexWithdrawParams) => {
      if (walletTypeRef.current === 'wallet-connect') {
        const wc = getWalletConnect();
        const result = await wc.dexWithdraw({ token, amount, feeToken });
        return result.hash;
      }
      if (!walletClient || !address) throw new Error('Not connected');
      return Actions.dex.withdraw(walletClient, { token, amount, feeToken });
    },
    [walletClient, address]
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
    connectWallet,
    disconnect,
    sendPayment,
    sendScheduledPayment,
    swapTokens,
    addLiquidity,
    removeLiquidity,
    buyTokens,
    placeOrder,
    cancelOrder,
    createPair,
    approveToken,
    createToken,
    mintToken,
    burnToken,
    claimRewards,
    dexWithdraw,
    encodeMemo,
    decodeMemo,
  };
}

interface UseTokenBalanceReturn {
  data: { value: bigint };
  isLoading: boolean;
}

export function useTokenBalance(token: Address | undefined, account?: Address): UseTokenBalanceReturn {
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
