import type { Address, Hash, Hex } from 'viem';

/**
 * Connected app information
 */
export interface ConnectedApp {
  id: string;
  name: string;
  url: string;
  icon?: string;
  description?: string;
  connectedAt: number;
  lastUsedAt: number;
  permissions: AppPermission[];
}

/**
 * App permissions
 */
export type AppPermission = 'connect' | 'sign' | 'send';

/**
 * Wallet Connect Request Types
 */
export type WalletConnectMethod =
  | 'connect'
  | 'disconnect'
  | 'sign_message'
  | 'sign_transaction'
  | 'send_transaction';

/**
 * Base request structure
 */
export interface WalletConnectRequest {
  id: string;
  method: WalletConnectMethod;
  origin: string;
  timestamp: number;
}

/**
 * Connect request from an app
 */
export interface ConnectRequest extends WalletConnectRequest {
  method: 'connect';
  params: {
    appName: string;
    appIcon?: string;
    appDescription?: string;
    permissions?: AppPermission[];
  };
}

/**
 * Disconnect request from an app
 */
export interface DisconnectRequest extends WalletConnectRequest {
  method: 'disconnect';
  params: Record<string, never>;
}

/**
 * Sign message request
 */
export interface SignMessageRequest extends WalletConnectRequest {
  method: 'sign_message';
  params: {
    message: string;
  };
}

/**
 * Transaction parameters for signing/sending
 */
export interface TransactionParams {
  to: Address;
  value?: bigint | string;
  data?: Hex;
  feeToken?: Address;
  memo?: string;
}

/**
 * Sign transaction request (returns signed tx, doesn't broadcast)
 */
export interface SignTransactionRequest extends WalletConnectRequest {
  method: 'sign_transaction';
  params: {
    transaction: TransactionParams;
  };
}

/**
 * Send transaction request (signs and broadcasts)
 */
export interface SendTransactionRequest extends WalletConnectRequest {
  method: 'send_transaction';
  params: {
    transaction: TransactionParams;
  };
}

/**
 * Union type for all request types
 */
export type AnyWalletConnectRequest =
  | ConnectRequest
  | DisconnectRequest
  | SignMessageRequest
  | SignTransactionRequest
  | SendTransactionRequest;

/**
 * Response types
 */
export interface WalletConnectResponse {
  id: string;
  success: boolean;
  error?: string;
}

export interface ConnectResponse extends WalletConnectResponse {
  result?: {
    address: Address;
    chainId: number;
  };
}

export interface SignMessageResponse extends WalletConnectResponse {
  result?: {
    signature: Hex;
  };
}

export interface SignTransactionResponse extends WalletConnectResponse {
  result?: {
    signedTransaction: Hex;
  };
}

export interface SendTransactionResponse extends WalletConnectResponse {
  result?: {
    hash: Hash;
  };
}

/**
 * Pending request with additional UI state
 */
export interface PendingRequest {
  request: AnyWalletConnectRequest;
  appInfo: {
    name: string;
    url: string;
    icon?: string;
  };
  status: 'pending' | 'approved' | 'rejected';
}

/**
 * Transaction modal states
 */
export type TransactionModalState = 'confirm' | 'pending' | 'success' | null;

/**
 * Activity/History types
 */
export type ActivityType =
  | 'connect'
  | 'sign_message'
  | 'send_payment'
  | 'send_scheduled_payment'
  | 'swap_tokens'
  | 'add_liquidity'
  | 'remove_liquidity'
  | 'send_transaction';

export type ActivityStatus = 'success' | 'failed' | 'rejected' | 'timeout';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  status: ActivityStatus;
  timestamp: number;
  appName: string;
  appUrl: string;
  appIcon?: string;
  txHash?: Hash;
  details?: Record<string, unknown>;
}
