import type { Address, Hash, Hex } from 'viem';

/**
 * Wallet Connect Protocol Version
 */
export const WALLET_CONNECT_VERSION = '1.0.0';

/**
 * App permissions
 */
export type AppPermission = 'connect' | 'sign' | 'send';

/**
 * Configuration for the wallet connect client
 */
export interface WalletConnectConfig {
  /**
   * The name of your app (shown to users)
   */
  appName: string;

  /**
   * The URL of your app
   */
  appUrl?: string;

  /**
   * Optional icon URL for your app
   */
  appIcon?: string;

  /**
   * Optional description of your app
   */
  appDescription?: string;

  /**
   * The URL of the Temporium Wallet
   * @default 'https://wallet.temporium.xyz'
   */
  walletUrl?: string;

  /**
   * Permissions to request
   * @default ['connect', 'sign', 'send']
   */
  permissions?: AppPermission[];
}

/**
 * Connection result
 */
export interface ConnectionResult {
  address: Address;
  chainId: number;
}

/**
 * Sign message result
 */
export interface SignMessageResult {
  signature: Hex;
}

/**
 * Transaction result (used for all transaction types)
 */
export interface TransactionResult {
  hash: Hash;
}

// ============================================================================
// Tempo SDK Compatible Types
// These match the tempo.ts SDK types for seamless migration
// ============================================================================

/**
 * Parameters for sending a payment
 * Compatible with tempo.ts Actions.token.transfer
 */
export interface SendPaymentParams {
  /** Recipient address */
  to: Address;
  /** Amount in smallest units (e.g., 1000000 = 1 USD with 6 decimals) */
  amount: bigint;
  /** Token address to send (defaults to USD) */
  token?: Address;
  /** Token to pay fees with (defaults to USD) */
  feeToken?: Address;
  /** Optional memo (up to 32 bytes) */
  memo?: string;
}

/**
 * Parameters for sending a scheduled payment
 * Compatible with tempo.ts Actions.token.transfer with validAfter
 */
export interface SendScheduledPaymentParams extends SendPaymentParams {
  /** Unix timestamp (seconds) when the transaction should execute */
  scheduledFor: number;
}

/**
 * Parameters for swapping tokens
 * Compatible with tempo.ts Actions.dex.sell
 */
export interface SwapParams {
  /** Token to swap from */
  tokenIn: Address;
  /** Token to swap to */
  tokenOut: Address;
  /** Amount of tokenIn to swap */
  amountIn: bigint;
  /** Minimum amount of tokenOut to receive (slippage protection) */
  minAmountOut: bigint;
  /** Token to pay fees with (defaults to USD) */
  feeToken?: Address;
}

/**
 * Parameters for adding liquidity
 * Compatible with tempo.ts Actions.amm.mint
 */
export interface AddLiquidityParams {
  /** User token address */
  userToken: Address;
  /** Validator token address */
  validatorToken: Address;
  /** Amount of validator tokens to add */
  validatorTokenAmount: bigint;
  /** Token to pay fees with (defaults to USD) */
  feeToken?: Address;
}

/**
 * Parameters for removing liquidity
 * Compatible with tempo.ts Actions.amm.burn
 */
export interface RemoveLiquidityParams {
  /** User token address */
  userToken: Address;
  /** Validator token address */
  validatorToken: Address;
  /** Amount of LP tokens to burn */
  liquidity: bigint;
  /** Token to pay fees with (defaults to USD) */
  feeToken?: Address;
}

// ============================================================================
// Internal Protocol Types
// ============================================================================

/**
 * Wallet Connect Request (internal)
 */
export interface WalletConnectRequest {
  id: string;
  method: string;
  origin: string;
  timestamp: number;
  params?: unknown;
}

/**
 * Wallet Connect Response (internal)
 */
export interface WalletConnectResponse {
  id: string;
  success: boolean;
  error?: string;
  result?: unknown;
}

/**
 * Message format for postMessage communication (internal)
 */
export interface WalletConnectMessage {
  type: 'TEMPO_WALLET_REQUEST' | 'TEMPO_WALLET_RESPONSE' | 'TEMPO_WALLET_READY';
  version: string;
  payload?: WalletConnectRequest | WalletConnectResponse;
}
