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
  | 'verify_connection'
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
 * Verify connection request (lightweight check if still connected)
 */
export interface VerifyConnectionRequest extends WalletConnectRequest {
  method: 'verify_connection';
  params: {
    address?: string;
  };
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
  | VerifyConnectionRequest
  | SignMessageRequest
  | SignTransactionRequest
  | SendTransactionRequest;

/**
 * Error codes for programmatic error handling
 */
export type WalletConnectErrorCode =
  | 'NOT_CONNECTED'
  | 'CONNECTION_REVOKED'
  | 'CONNECTION_TIMEOUT'
  | 'POPUP_BLOCKED'
  | 'PERMISSION_DENIED'
  | 'SIGN_PERMISSION_REQUIRED'
  | 'SEND_PERMISSION_REQUIRED'
  | 'INVALID_ADDRESS'
  | 'INVALID_AMOUNT'
  | 'INVALID_PARAMS'
  | 'MISSING_REQUIRED_FIELD'
  | 'INSUFFICIENT_BALANCE'
  | 'TRANSACTION_FAILED'
  | 'GAS_ESTIMATION_FAILED'
  | 'NONCE_CONFLICT'
  | 'USER_REJECTED'
  | 'REQUEST_TIMEOUT'
  | 'NETWORK_ERROR'
  | 'WALLET_NOT_READY'
  | 'UNKNOWN';

/**
 * Response types
 */
export interface WalletConnectResponse {
  id: string;
  success: boolean;
  error?: string;
  errorCode?: WalletConnectErrorCode;
  result?: unknown;
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
 * Activity/History types
 */
export type ActivityType = 'connect' | 'sign_message' | 'sign_transaction' | 'send_transaction';

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
