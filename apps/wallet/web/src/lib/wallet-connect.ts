/**
 * Wallet Connect Protocol
 *
 * Handles communication between the wallet app and other Tempo apps
 * Uses postMessage API for cross-origin communication
 */

import { WALLET_CONNECT_VERSION } from './constants';
import {
  isAppConnected,
  saveConnectedApp,
  updateAppLastUsed,
  hasPermission,
} from './connected-apps';
import type {
  AnyWalletConnectRequest,
  WalletConnectResponse,
  ConnectRequest,
  ConnectResponse,
  SignMessageRequest,
  SignMessageResponse,
  SignTransactionRequest,
  SignTransactionResponse,
  SendTransactionRequest,
  SendTransactionResponse,
  PendingRequest,
} from '@/types';

/**
 * Message types for postMessage communication
 */
export interface WalletConnectMessage {
  type: 'TEMPO_WALLET_REQUEST' | 'TEMPO_WALLET_RESPONSE';
  version: string;
  payload: AnyWalletConnectRequest | WalletConnectResponse;
}

/**
 * Validate incoming message is from a valid origin
 */
function isValidOrigin(origin: string): boolean {
  // In production, you might want to restrict this to known Tempo domains
  // For now, allow all origins but log them
  console.log(`[WalletConnect] Request from origin: ${origin}`);
  return true;
}

/**
 * Parse and validate incoming message
 */
export function parseMessage(
  event: MessageEvent
): { request: AnyWalletConnectRequest; origin: string } | null {
  try {
    // Validate origin
    if (!isValidOrigin(event.origin)) {
      console.warn(`[WalletConnect] Invalid origin: ${event.origin}`);
      return null;
    }

    const message = event.data as WalletConnectMessage;

    // Check message type
    if (message.type !== 'TEMPO_WALLET_REQUEST') {
      return null;
    }

    // Check version compatibility
    if (!message.version || !message.version.startsWith('1.')) {
      console.warn(`[WalletConnect] Incompatible version: ${message.version}`);
      return null;
    }

    const request = message.payload as AnyWalletConnectRequest;

    // Validate request structure
    if (!request.id || !request.method || !request.timestamp) {
      console.warn('[WalletConnect] Invalid request structure');
      return null;
    }

    return {
      request: {
        ...request,
        origin: event.origin,
      },
      origin: event.origin,
    };
  } catch (error) {
    console.error('[WalletConnect] Failed to parse message:', error);
    return null;
  }
}

/**
 * Send response back to the requesting app
 */
export function sendResponse(
  targetOrigin: string,
  response: WalletConnectResponse,
  targetWindow?: Window
): void {
  const message: WalletConnectMessage = {
    type: 'TEMPO_WALLET_RESPONSE',
    version: WALLET_CONNECT_VERSION,
    payload: response,
  };

  // If we have a reference to the target window (e.g., opener), use it
  // Otherwise, try to find the window or use broadcast
  const target = targetWindow || window.opener;

  if (target && !target.closed) {
    target.postMessage(message, targetOrigin);
  } else {
    console.warn('[WalletConnect] Target window not available');
  }
}

/**
 * Create a pending request object for UI display
 */
export function createPendingRequest(
  request: AnyWalletConnectRequest,
  origin: string
): PendingRequest {
  let appName = 'Unknown App';
  let appIcon: string | undefined;

  if (request.method === 'connect') {
    const connectReq = request as ConnectRequest;
    appName = connectReq.params.appName;
    appIcon = connectReq.params.appIcon;
  } else {
    // Try to extract app name from origin
    try {
      const url = new URL(origin);
      appName = url.hostname;
    } catch {
      appName = origin;
    }
  }

  return {
    request,
    appInfo: {
      name: appName,
      url: origin,
      icon: appIcon,
    },
    status: 'pending',
  };
}

/**
 * Handle connect request - auto-approve if already connected, otherwise show UI
 */
export function handleConnectRequest(
  request: ConnectRequest,
  origin: string
): { autoApprove: boolean; response?: ConnectResponse } {
  // Check if already connected
  if (isAppConnected(origin)) {
    updateAppLastUsed(origin);
    return {
      autoApprove: true,
      // Response will be sent by the component after getting the address
    };
  }

  // Needs user approval
  return { autoApprove: false };
}

/**
 * Approve connect request
 */
export function approveConnect(
  request: ConnectRequest,
  address: `0x${string}`,
  chainId: number
): ConnectResponse {
  // Save connected app
  saveConnectedApp({
    name: request.params.appName,
    url: request.origin,
    icon: request.params.appIcon,
    description: request.params.appDescription,
    connectedAt: Date.now(),
    lastUsedAt: Date.now(),
    permissions: request.params.permissions || ['connect', 'sign', 'send'],
  });

  return {
    id: request.id,
    success: true,
    result: {
      address,
      chainId,
    },
  };
}

/**
 * Reject connect request
 */
export function rejectConnect(request: ConnectRequest, reason?: string): ConnectResponse {
  return {
    id: request.id,
    success: false,
    error: reason || 'User rejected connection',
  };
}

/**
 * Handle sign message request
 */
export function handleSignMessageRequest(
  request: SignMessageRequest,
  origin: string
): { authorized: boolean; error?: string } {
  if (!isAppConnected(origin)) {
    return { authorized: false, error: 'App not connected' };
  }

  if (!hasPermission(origin, 'sign')) {
    return { authorized: false, error: 'App does not have sign permission' };
  }

  updateAppLastUsed(origin);
  return { authorized: true };
}

/**
 * Create sign message response
 */
export function createSignMessageResponse(
  request: SignMessageRequest,
  signature?: `0x${string}`,
  error?: string
): SignMessageResponse {
  if (error || !signature) {
    return {
      id: request.id,
      success: false,
      error: error || 'Signing failed',
    };
  }

  return {
    id: request.id,
    success: true,
    result: { signature },
  };
}

/**
 * Handle sign transaction request
 */
export function handleSignTransactionRequest(
  request: SignTransactionRequest,
  origin: string
): { authorized: boolean; error?: string } {
  if (!isAppConnected(origin)) {
    return { authorized: false, error: 'App not connected' };
  }

  if (!hasPermission(origin, 'sign')) {
    return { authorized: false, error: 'App does not have sign permission' };
  }

  updateAppLastUsed(origin);
  return { authorized: true };
}

/**
 * Create sign transaction response
 */
export function createSignTransactionResponse(
  request: SignTransactionRequest,
  signedTransaction?: `0x${string}`,
  error?: string
): SignTransactionResponse {
  if (error || !signedTransaction) {
    return {
      id: request.id,
      success: false,
      error: error || 'Signing failed',
    };
  }

  return {
    id: request.id,
    success: true,
    result: { signedTransaction },
  };
}

/**
 * Handle send transaction request
 */
export function handleSendTransactionRequest(
  request: SendTransactionRequest,
  origin: string
): { authorized: boolean; error?: string } {
  if (!isAppConnected(origin)) {
    return { authorized: false, error: 'App not connected' };
  }

  if (!hasPermission(origin, 'send')) {
    return { authorized: false, error: 'App does not have send permission' };
  }

  updateAppLastUsed(origin);
  return { authorized: true };
}

/**
 * Create send transaction response
 */
export function createSendTransactionResponse(
  request: SendTransactionRequest,
  hash?: `0x${string}`,
  error?: string
): SendTransactionResponse {
  if (error || !hash) {
    return {
      id: request.id,
      success: false,
      error: error || 'Transaction failed',
    };
  }

  return {
    id: request.id,
    success: true,
    result: { hash },
  };
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
