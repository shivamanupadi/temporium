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

  /**
   * Callback when connection state changes (connected, disconnected, or verified invalid)
   * Use this to react to connection state changes in your app
   */
  onConnectionChange?: (status: { isConnected: boolean; address: Address | null; wasRevoked?: boolean }) => void;
}

/**
 * Connection result
 */
export interface ConnectionResult {
  address: Address;
  chainId: number;
}

/**
 * Connection state (stored in localStorage)
 */
export interface ConnectionState {
  address: Address;
  chainId: number;
  connectedAt: number;
  walletUrl: string;
}

/**
 * Connection event types
 */
export type ConnectionEventType = 'connect' | 'disconnect';

/**
 * Connection event listener
 */
export type ConnectionEventListener = (event: {
  type: ConnectionEventType;
  address: Address | null;
  chainId: number | null;
}) => void;

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
  /** Token address to send */
  token: Address;
  /** Token to pay fees with (defaults to USD) */
  feeToken?: Address;
  /** Optional memo (hex-encoded, up to 32 bytes) */
  memo?: `0x${string}`;
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
  userTokenAddress: Address;
  /** Validator token address */
  validatorTokenAddress: Address;
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
  userTokenAddress: Address;
  /** Validator token address */
  validatorTokenAddress: Address;
  /** Amount of LP tokens to burn */
  liquidity: bigint;
  /** Token to pay fees with (defaults to USD) */
  feeToken?: Address;
}

/**
 * Parameters for buying tokens via DEX
 * Compatible with tempo.ts Actions.dex.buy
 */
export interface BuyTokensParams {
  /** Token to pay with */
  tokenIn: Address;
  /** Token to receive */
  tokenOut: Address;
  /** Exact amount of tokenOut to receive */
  amountOut: bigint;
  /** Maximum amount of tokenIn to spend */
  maxAmountIn: bigint;
  /** Token to pay fees with (defaults to USD) */
  feeToken?: Address;
}

/**
 * Parameters for placing a limit order
 * Compatible with tempo.ts Actions.dex.place
 */
export interface PlaceOrderParams {
  /** Token address */
  token: Address;
  /** Order amount */
  amount: bigint;
  /** Price tick */
  tick: number;
  /** Order type */
  type: 'buy' | 'sell';
  /** Token to pay fees with (defaults to USD) */
  feeToken?: Address;
}

/**
 * Parameters for cancelling a limit order
 * Compatible with tempo.ts Actions.dex.cancel
 */
export interface CancelOrderParams {
  /** Order ID to cancel */
  orderId: bigint;
  /** Token to pay fees with (defaults to USD) */
  feeToken?: Address;
}

/**
 * Parameters for creating a DEX pair
 * Compatible with tempo.ts Actions.dex.createPair
 */
export interface CreatePairParams {
  /** Base token address */
  base: Address;
  /** Token to pay fees with (defaults to USD) */
  feeToken?: Address;
}

/**
 * Parameters for approving a token spender
 * Compatible with tempo.ts Actions.token.approve
 */
export interface ApproveTokenParams {
  /** Token address */
  token: Address;
  /** Spender address to approve */
  spender: Address;
  /** Amount to approve */
  amount: bigint;
  /** Token to pay fees with (defaults to USD) */
  feeToken?: Address;
}

/**
 * Parameters for creating a new token
 * Compatible with tempo.ts Actions.token.create
 */
export interface CreateTokenParams {
  /** Token name */
  name: string;
  /** Token symbol */
  symbol: string;
  /** Currency code (e.g., 'USD') */
  currency: string;
  /** Admin address (defaults to sender) */
  admin?: Address;
  /** Quote token address for DEX pairing */
  quoteToken?: Address;
  /** Optional salt for deterministic address */
  salt?: `0x${string}`;
}

/**
 * Parameters for minting tokens
 * Compatible with tempo.ts Actions.token.mint
 */
export interface MintTokenParams {
  /** Token address */
  token: Address;
  /** Recipient address */
  to: Address;
  /** Amount to mint */
  amount: bigint;
  /** Optional memo */
  memo?: `0x${string}`;
  /** Token to pay fees with (defaults to USD) */
  feeToken?: Address;
}

/**
 * Parameters for burning tokens
 * Compatible with tempo.ts Actions.token.burn
 */
export interface BurnTokenParams {
  /** Token address */
  token: Address;
  /** Amount to burn */
  amount: bigint;
  /** Optional memo */
  memo?: `0x${string}`;
  /** Token to pay fees with (defaults to USD) */
  feeToken?: Address;
}

/**
 * Parameters for claiming rewards
 * Compatible with tempo.ts Actions.reward.claim
 */
export interface ClaimRewardsParams {
  /** Token address to claim rewards for */
  token: Address;
  /** Token to pay fees with (defaults to USD) */
  feeToken?: Address;
}

/**
 * Parameters for withdrawing from DEX
 * Compatible with tempo.ts Actions.dex.withdraw
 */
export interface DexWithdrawParams {
  /** Token address to withdraw */
  token: Address;
  /** Amount to withdraw */
  amount: bigint;
  /** Token to pay fees with (defaults to USD) */
  feeToken?: Address;
}

/**
 * Parameters for swapping via AMM (rebalanceSwap)
 * Compatible with tempo.ts Actions.amm.rebalanceSwap
 */
export interface AmmSwapParams {
  /** User token address (token to receive) */
  userToken: Address;
  /** Validator token address (token to pay) */
  validatorToken: Address;
  /** Amount of user token to receive */
  amountOut: bigint;
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
 * Error codes for better error handling in consuming apps
 */
export enum WalletConnectErrorCode {
  // Connection errors
  NOT_CONNECTED = 'NOT_CONNECTED',
  CONNECTION_REVOKED = 'CONNECTION_REVOKED',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  POPUP_BLOCKED = 'POPUP_BLOCKED',

  // Permission errors
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  SIGN_PERMISSION_REQUIRED = 'SIGN_PERMISSION_REQUIRED',
  SEND_PERMISSION_REQUIRED = 'SEND_PERMISSION_REQUIRED',

  // Validation errors
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_PARAMS = 'INVALID_PARAMS',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Transaction errors
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  GAS_ESTIMATION_FAILED = 'GAS_ESTIMATION_FAILED',
  NONCE_CONFLICT = 'NONCE_CONFLICT',

  // User actions
  USER_REJECTED = 'USER_REJECTED',
  REQUEST_TIMEOUT = 'REQUEST_TIMEOUT',

  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  WALLET_NOT_READY = 'WALLET_NOT_READY',

  // Unknown
  UNKNOWN = 'UNKNOWN',
}

/**
 * Wallet Connect error with code for programmatic handling
 */
export class WalletConnectError extends Error {
  code: WalletConnectErrorCode;
  details?: Record<string, unknown>;

  constructor(code: WalletConnectErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'WalletConnectError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Wallet Connect Response (internal)
 */
export interface WalletConnectResponse {
  id: string;
  success: boolean;
  error?: string;
  errorCode?: WalletConnectErrorCode;
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
