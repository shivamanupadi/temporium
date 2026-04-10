import type { Address, Chain, Hex } from 'viem';

/**
 * Configuration for the wallet connect client
 */
export interface WalletConnectConfig {
  /** App name shown to users in the wallet popup */
  appName: string;
  /** App URL */
  appUrl?: string;
  /** App icon URL */
  appIcon?: string;
  /** App description */
  appDescription?: string;
  /** Temporium Wallet URL (default: https://wallet.temporium.xyz) */
  walletUrl?: string;
  /** Tempo chain with serializers/formatters — required for getWalletClient() */
  chain?: Chain;
  /** Callback when connection state changes */
  onConnectionChange?: (status: {
    isConnected: boolean;
    address: Address | null;
  }) => void;
}

export interface ConnectionResult {
  address: Address;
  chainId: number;
}

export type ConnectionEventType = 'connect' | 'disconnect';

export type ConnectionEventListener = (event: {
  type: ConnectionEventType;
  address: Address | null;
  chainId: number | null;
}) => void;

// ============================================================================
// Tempo Action Parameter Types
// ============================================================================

export interface SendPaymentParams {
  to: Address;
  amount: bigint;
  token: Address;
  feeToken?: Address;
  memo?: `0x${string}`;
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
  userTokenAddress: Address;
  validatorTokenAddress: Address;
  validatorTokenAmount: bigint;
  feeToken?: Address;
}

export interface RemoveLiquidityParams {
  userTokenAddress: Address;
  validatorTokenAddress: Address;
  liquidity: bigint;
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

export interface BatchTransfer {
  to: Address;
  amount: bigint;
  memo?: `0x${string}`;
}

export interface BatchSendParams {
  token: Address;
  transfers: BatchTransfer[];
  feeToken?: Address;
}

export interface AmmSwapParams {
  userToken: Address;
  validatorToken: Address;
  amountOut: bigint;
  feeToken?: Address;
}
