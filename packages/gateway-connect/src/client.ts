import type { Address, Hex } from 'viem';
import { createWalletClient, custom, http, type WalletClient } from 'viem';
import { toAccount } from 'viem/accounts';
import {
  WALLET_CONNECT_VERSION,
  WalletConnectErrorCode,
  WalletConnectError,
  type WalletConnectConfig,
  type ConnectionResult,
  type ConnectionState,
  type ConnectionEventType,
  type ConnectionEventListener,
  type SignMessageResult,
  type SignTransactionResult,
  type WalletConnectMessage,
  type WalletConnectResponse,
} from './types';

/**
 * Storage key for connection state
 */
const STORAGE_KEY = 'temporium_wallet_connection';

/**
 * Default wallet URL
 */
const DEFAULT_WALLET_URL = 'https://wallet.temporium.xyz';

/**
 * Default timeouts
 */
const CONNECTION_TIMEOUT = 60000; // 1 minute
const SIGNING_TIMEOUT = 120000; // 2 minutes

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Keys to strip from prepared transactions before postMessage transport.
 * These are complex objects (with methods/functions) added by viem's
 * prepareTransactionRequest that can't be serialized via structured clone.
 */
const NON_SERIALIZABLE_TX_KEYS = new Set([
  'account', 'chain', 'abi', 'functionName', 'args',
]);

/**
 * Serialize a transaction object for postMessage transport.
 * - Strips non-serializable keys (account, chain, abi, etc.)
 * - Converts BigInt values to prefixed strings
 * - Skips functions and undefined values
 */
function serializeTxForTransport(tx: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(tx)) {
    if (NON_SERIALIZABLE_TX_KEYS.has(key)) continue;
    if (typeof value === 'function' || typeof value === 'undefined') continue;
    if (typeof value === 'bigint') {
      result[key] = `__bigint:${value.toString()}`;
    } else if (Array.isArray(value)) {
      result[key] = value;
    } else if (typeof value === 'object' && value !== null) {
      result[key] = serializeTxForTransport(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Temporium Gateway Connect Client
 *
 * Enables dApps to connect to Temporium Wallet and get a standard viem WalletClient
 * for signing transactions via the wallet popup.
 *
 * @example
 * ```typescript
 * import { GatewayConnect } from '@temporium/gateway-connect';
 * import { Actions } from 'viem/tempo';
 *
 * const gateway = new GatewayConnect({
 *   appName: 'My App',
 *   chain: tempoModerato,
 * });
 *
 * await gateway.connect();
 * const walletClient = gateway.getWalletClient();
 *
 * // Use Actions.* directly — same as browser wallet
 * const hash = await Actions.token.transfer(walletClient, {
 *   token, to, amount, feeToken,
 * });
 * ```
 */
// Internal config type that requires all fields except callbacks, optional rpcUrl and chain
type InternalConfig = Required<Omit<WalletConnectConfig, 'onConnectionChange' | 'rpcUrl' | 'chain'>>
  & Pick<WalletConnectConfig, 'onConnectionChange' | 'rpcUrl' | 'chain'>;

export class GatewayConnect {
  private config: InternalConfig;
  private walletWindow: Window | null = null;
  private pendingRequests: Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  > = new Map();
  private _isConnected = false;
  private _address: Address | null = null;
  private _chainId: number | null = null;
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private eventListeners: Map<ConnectionEventType, Set<ConnectionEventListener>> = new Map();

  private onConnectionChange?: (status: { isConnected: boolean; address: Address | null; wasRevoked?: boolean }) => void;
  private _connectionVerified = false;

  constructor(config: WalletConnectConfig) {
    this.config = {
      appName: config.appName,
      appUrl: config.appUrl || (typeof window !== 'undefined' ? window.location.origin : ''),
      appIcon: config.appIcon || '',
      appDescription: config.appDescription || '',
      walletUrl: config.walletUrl || DEFAULT_WALLET_URL,
      permissions: config.permissions || ['connect', 'sign', 'send'],
      rpcUrl: config.rpcUrl,
      chain: config.chain,
      onConnectionChange: config.onConnectionChange,
    };

    this.onConnectionChange = config.onConnectionChange;

    // Initialize event listener maps
    this.eventListeners.set('connect', new Set());
    this.eventListeners.set('disconnect', new Set());

    // Restore connection from storage (but mark as unverified)
    this.restoreConnection();

    // Set up message listener
    if (typeof window !== 'undefined') {
      this.setupMessageListener();
    }
  }

  // ============================================================================
  // Connection Status API
  // ============================================================================

  /**
   * Check if the wallet is currently connected
   */
  isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * Get the connected wallet address
   */
  getAddress(): Address | null {
    return this._address;
  }

  /**
   * Get the connected chain ID
   */
  getChainId(): number | null {
    return this._chainId;
  }

  /**
   * Get the full connection status
   */
  getConnectionStatus(): { isConnected: boolean; address: Address | null; chainId: number | null; verified: boolean } {
    return {
      isConnected: this._isConnected,
      address: this._address,
      chainId: this._chainId,
      verified: this._connectionVerified,
    };
  }

  /**
   * Check if the connection has been verified this session
   */
  isConnectionVerified(): boolean {
    return this._connectionVerified;
  }

  // ============================================================================
  // Event Listeners
  // ============================================================================

  on(event: ConnectionEventType, listener: ConnectionEventListener): void {
    this.eventListeners.get(event)?.add(listener);
  }

  off(event: ConnectionEventType, listener: ConnectionEventListener): void {
    this.eventListeners.get(event)?.delete(listener);
  }

  private emit(event: ConnectionEventType): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const eventData = {
        type: event,
        address: this._address,
        chainId: this._chainId,
      };
      listeners.forEach(listener => listener(eventData));
    }
  }

  // ============================================================================
  // Connection Persistence
  // ============================================================================

  private restoreConnection(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const state: ConnectionState = JSON.parse(stored);

      if (state.walletUrl !== this.config.walletUrl) {
        this.clearStoredConnection();
        return;
      }

      this._isConnected = true;
      this._address = state.address;
      this._chainId = state.chainId;

      console.log('[GatewayConnect] Restored connection:', state.address);
    } catch (err) {
      console.warn('[GatewayConnect] Failed to restore connection:', err);
      this.clearStoredConnection();
    }
  }

  private saveConnection(address: Address, chainId: number): void {
    if (typeof window === 'undefined') return;

    try {
      const state: ConnectionState = {
        address,
        chainId,
        connectedAt: Date.now(),
        walletUrl: this.config.walletUrl,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('[GatewayConnect] Failed to save connection:', err);
    }
  }

  private clearStoredConnection(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn('[GatewayConnect] Failed to clear connection:', err);
    }
  }

  // ============================================================================
  // Message Handling
  // ============================================================================

  private setupMessageListener(): void {
    if (this.messageHandler) return;

    this.messageHandler = (event: MessageEvent) => {
      const walletOrigin = new URL(this.config.walletUrl).origin;
      if (event.origin !== walletOrigin) return;

      const message = event.data as WalletConnectMessage;

      if (message.type === 'TEMPO_WALLET_READY') {
        console.log('[GatewayConnect] Wallet is ready');
        return;
      }

      if (message.type === 'TEMPO_WALLET_RESPONSE' && message.payload) {
        const response = message.payload as WalletConnectResponse;
        const pending = this.pendingRequests.get(response.id);

        if (pending) {
          this.pendingRequests.delete(response.id);

          if (response.success) {
            pending.resolve(response.result);
          } else {
            const errorCode = response.errorCode || WalletConnectErrorCode.UNKNOWN;
            const error = new WalletConnectError(
              errorCode,
              response.error || 'Request failed'
            );

            if (
              errorCode === WalletConnectErrorCode.NOT_CONNECTED ||
              errorCode === WalletConnectErrorCode.CONNECTION_REVOKED
            ) {
              this.handleRevocation();
            }

            pending.reject(error);
          }
        }
      }
    };

    window.addEventListener('message', this.messageHandler);
  }

  /**
   * @deprecated Use disconnect() instead
   */
  public destroy(): void {
    this.disconnect();
  }

  private openWalletWindow(path: string): Window {
    const url = `${this.config.walletUrl}${path}`;
    const width = 400;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      url,
      'temporium-wallet',
      `width=${width},height=${height},left=${left},top=${top},popup=yes`
    );

    if (!popup) {
      throw new WalletConnectError(
        WalletConnectErrorCode.POPUP_BLOCKED,
        'Failed to open wallet popup. Please allow popups for this site.'
      );
    }

    return popup;
  }

  private async sendRequest<T>(
    path: string,
    method: string,
    params: unknown,
    timeout: number
  ): Promise<T> {
    const requestId = generateRequestId();

    this.walletWindow = this.openWalletWindow(path);

    const responsePromise = new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new WalletConnectError(WalletConnectErrorCode.REQUEST_TIMEOUT, 'Request timed out'));
        }
      }, timeout);
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    const message: WalletConnectMessage = {
      type: 'TEMPO_WALLET_REQUEST',
      version: WALLET_CONNECT_VERSION,
      payload: {
        id: requestId,
        method,
        origin: this.config.appUrl,
        timestamp: Date.now(),
        params,
      },
    };

    const sendMessage = () => {
      if (this.walletWindow && !this.walletWindow.closed) {
        try {
          this.walletWindow.postMessage(message, new URL(this.config.walletUrl).origin);
        } catch {
          // Wallet might not be ready yet
        }
      }
    };

    sendMessage();
    const retryInterval = setInterval(sendMessage, 500);

    const windowCloseInterval = setInterval(() => {
      if (this.walletWindow?.closed && this.pendingRequests.has(requestId)) {
        clearInterval(windowCloseInterval);
        setTimeout(() => {
          if (this.pendingRequests.has(requestId)) {
            const pending = this.pendingRequests.get(requestId);
            this.pendingRequests.delete(requestId);
            pending?.reject(new WalletConnectError(
              WalletConnectErrorCode.USER_REJECTED,
              'User closed the wallet window'
            ));
          }
        }, 200);
      }
    }, 300);

    responsePromise.finally(() => {
      clearInterval(retryInterval);
      clearInterval(windowCloseInterval);
    });

    return responsePromise;
  }

  // ============================================================================
  // Connection Methods
  // ============================================================================

  async connect(options?: { force?: boolean; skipVerification?: boolean }): Promise<ConnectionResult> {
    if (this._isConnected && this._address && this._chainId && !options?.force) {
      if (this._connectionVerified) {
        return { address: this._address, chainId: this._chainId };
      }

      if (options?.skipVerification) {
        return { address: this._address, chainId: this._chainId };
      }

      const isValid = await this.verifyConnection();
      if (isValid) {
        return { address: this._address!, chainId: this._chainId! };
      }
    }

    const result = await this.sendRequest<ConnectionResult>(
      '/connect',
      'connect',
      {
        appName: this.config.appName,
        appIcon: this.config.appIcon,
        appDescription: this.config.appDescription,
        permissions: this.config.permissions,
      },
      CONNECTION_TIMEOUT
    );

    this._isConnected = true;
    this._address = result.address;
    this._chainId = result.chainId;
    this._connectionVerified = true;

    this.saveConnection(result.address, result.chainId);
    this.emit('connect');

    if (this.onConnectionChange) {
      this.onConnectionChange({ isConnected: true, address: result.address });
    }

    return result;
  }

  disconnect(): void {
    this.notifyWalletDisconnect();

    this._isConnected = false;
    this._address = null;
    this._chainId = null;

    this.clearStoredConnection();

    if (this.walletWindow && !this.walletWindow.closed) {
      this.walletWindow.close();
    }

    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }
    this.pendingRequests.clear();
    this.eventListeners.clear();

    this.emit('disconnect');
  }

  private notifyWalletDisconnect(): void {
    try {
      const walletOrigin = new URL(this.config.walletUrl).origin;
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = `${this.config.walletUrl}/connect`;
      document.body.appendChild(iframe);

      const message: WalletConnectMessage = {
        type: 'TEMPO_WALLET_REQUEST',
        version: WALLET_CONNECT_VERSION,
        payload: {
          id: generateRequestId(),
          method: 'disconnect',
          origin: this.config.appUrl,
          timestamp: Date.now(),
          params: {},
        },
      };

      iframe.onload = () => {
        try {
          iframe.contentWindow?.postMessage(message, walletOrigin);
        } catch {
          // Best effort
        }
        setTimeout(() => iframe.remove(), 1000);
      };

      setTimeout(() => iframe.remove(), 3000);
    } catch {
      // Best effort
    }
  }

  async verifyConnection(): Promise<boolean> {
    if (!this._isConnected || !this._address) {
      this._connectionVerified = true;
      return false;
    }

    try {
      const result = await this.sendRequest<{ valid: boolean; address?: Address }>(
        '/connect',
        'verify_connection',
        { address: this._address },
        10000
      );

      if (!result.valid) {
        this.handleRevocation();
        return false;
      }

      this._connectionVerified = true;
      return true;
    } catch (err) {
      if (err instanceof WalletConnectError) {
        if (
          err.code === WalletConnectErrorCode.NOT_CONNECTED ||
          err.code === WalletConnectErrorCode.CONNECTION_REVOKED
        ) {
          this.handleRevocation();
          return false;
        }
      }
      return this._isConnected;
    }
  }

  private handleRevocation(): void {
    const wasConnected = this._isConnected;
    this._isConnected = false;
    this._address = null;
    this._chainId = null;
    this._connectionVerified = true;
    this.clearStoredConnection();
    this.emit('disconnect');

    if (wasConnected && this.onConnectionChange) {
      this.onConnectionChange({ isConnected: false, address: null, wasRevoked: true });
    }
  }

  private ensureConnected(): void {
    if (!this._isConnected || !this._address) {
      throw new WalletConnectError(
        WalletConnectErrorCode.NOT_CONNECTED,
        'Wallet not connected. Please call connect() first.'
      );
    }
  }

  // ============================================================================
  // Signing Methods
  // ============================================================================

  /**
   * Sign a message (convenience method)
   *
   * @param message - The message to sign
   * @returns Signature result
   */
  async signMessage(message: string): Promise<SignMessageResult> {
    this.ensureConnected();

    if (!message || typeof message !== 'string') {
      throw new WalletConnectError(
        WalletConnectErrorCode.INVALID_PARAMS,
        'Message must be a non-empty string'
      );
    }

    const MAX_MESSAGE_LENGTH = 10240;
    if (message.length > MAX_MESSAGE_LENGTH) {
      throw new WalletConnectError(
        WalletConnectErrorCode.INVALID_PARAMS,
        `Message too long (${message.length} chars). Maximum is ${MAX_MESSAGE_LENGTH} characters.`,
        { field: 'message', length: message.length, max: MAX_MESSAGE_LENGTH }
      );
    }

    return this.sendRequest<SignMessageResult>(
      '/sign',
      'sign_message',
      { message },
      SIGNING_TIMEOUT
    );
  }

  // ============================================================================
  // WalletClient
  // ============================================================================

  /**
   * Get a standard viem WalletClient that routes signing through the wallet popup.
   *
   * Use this with `Actions.*` from `viem/tempo` — identical to how browser wallets work.
   *
   * @example
   * ```typescript
   * const walletClient = gateway.getWalletClient();
   * const hash = await Actions.token.transfer(walletClient, {
   *   token, to, amount, feeToken,
   * });
   * ```
   */
  getWalletClient(): WalletClient {
    this.ensureConnected();

    if (!this.config.chain) {
      throw new WalletConnectError(
        WalletConnectErrorCode.INVALID_PARAMS,
        'chain is required for getWalletClient(). Pass chain in the constructor config.'
      );
    }

    const self = this;
    const chain = this.config.chain;
    const rpcUrl = this.config.rpcUrl || chain.rpcUrls.default.http[0];

    // Custom transport that intercepts eth_estimateGas to avoid
    // "Unsupported signature type" errors for WebAuthn/passkey accounts.
    // The Tempo chain rejects gas estimation for non-secp256k1 accounts
    // on certain operations (e.g. createToken). A generous default gas
    // value is safe since Tempo uses feeToken for fees, not gas price.
    const transport = custom({
      async request({ method, params }: { method: string; params?: unknown }) {
        if (method === 'eth_estimateGas') {
          return '0x989680'; // 10M gas
        }
        const res = await globalThis.fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
        });
        const data = await res.json();
        if (data.error) {
          const err = new Error(data.error.message) as Error & { code?: number; data?: unknown };
          err.code = data.error.code;
          err.data = data.error.data;
          throw err;
        }
        return data.result;
      },
    });

    const account = toAccount({
      address: this._address!,

      async signMessage({ message }) {
        const msgStr = typeof message === 'string' ? message :
          typeof message === 'object' && 'raw' in message
            ? (typeof message.raw === 'string' ? message.raw : Buffer.from(message.raw).toString('hex'))
            : String(message);
        const result = await self.sendRequest<SignMessageResult>(
          '/sign', 'sign_message', { message: msgStr }, SIGNING_TIMEOUT
        );
        return result.signature;
      },

      async signTransaction(transaction) {
        const params = serializeTxForTransport(transaction as unknown as Record<string, unknown>);
        const { signedTransaction } = await self.sendRequest<SignTransactionResult>(
          '/sign', 'sign_transaction', params, SIGNING_TIMEOUT
        );
        return signedTransaction as Hex;
      },

      async signTypedData() {
        throw new WalletConnectError(
          WalletConnectErrorCode.INVALID_PARAMS,
          'signTypedData is not supported by GatewayConnect'
        );
      },
    });

    return createWalletClient({
      account,
      chain,
      transport,
    }) as unknown as WalletClient;
  }
}
