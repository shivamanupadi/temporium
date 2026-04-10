import type { Address, Chain, Hex } from 'viem';

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
   * RPC URL for the Tempo chain
   * If not provided, uses the chain's default RPC URL
   */
  rpcUrl?: string;

  /**
   * Tempo chain with serializers/formatters
   * Required for getWalletClient()
   */
  chain?: Chain;

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
 * Result from wallet sign-only operation
 */
export interface SignTransactionResult {
  signedTransaction: Hex;
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
 * A single recipient in a batch send operation
 */
export interface BatchTransfer {
  /** Recipient address */
  to: Address;
  /** Amount in smallest units */
  amount: bigint;
  /** Optional memo (hex-encoded, up to 32 bytes) */
  memo?: `0x${string}`;
}

/**
 * Parameters for batch sending tokens to multiple recipients
 * Uses walletClient.sendCalls() to bundle multiple transfers
 */
export interface BatchSendParams {
  /** Token address to send */
  token: Address;
  /** Array of recipients with amounts */
  transfers: BatchTransfer[];
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
