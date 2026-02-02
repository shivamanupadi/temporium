import type { Address, Hash, Hex } from 'viem';
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
  type TransactionResult,
  type SendPaymentParams,
  type SendScheduledPaymentParams,
  type SwapParams,
  type AddLiquidityParams,
  type RemoveLiquidityParams,
  type WalletConnectMessage,
  type WalletConnectResponse,
} from './types';

/**
 * Validate an Ethereum address
 */
function isValidAddress(address: unknown): address is Address {
  if (typeof address !== 'string') return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate that a value is a positive bigint
 */
function isValidAmount(amount: unknown): amount is bigint {
  if (typeof amount !== 'bigint') return false;
  return amount > 0n;
}

/**
 * Storage key for connection state
 */
const STORAGE_KEY = 'temporium_wallet_connection';

/**
 * Default wallet URL
 */
const DEFAULT_WALLET_URL = 'https://wallet.temporium.xyz';

/**
 * Default fee token (AlphaUSD on Tempo testnet)
 */
const DEFAULT_FEE_TOKEN = '0x20c0000000000000000000000000000000000001' as Address;

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
 * Convert a string memo to bytes32 hex
 */
function stringToBytes32(str: string): `0x${string}` {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  const truncated = bytes.slice(0, 32);
  const padded = new Uint8Array(32);
  padded.set(truncated);

  return `0x${Array.from(padded)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')}` as `0x${string}`;
}

/**
 * Temporium Wallet Connect Client
 *
 * Enables apps to connect to Temporium Wallet for authentication and transaction signing.
 * Connection state is persisted in localStorage and restored automatically.
 *
 * @example
 * ```typescript
 * import { WalletConnect } from '@temporium/wallet-connect';
 *
 * const wallet = new WalletConnect({
 *   appName: 'My App',
 *   appIcon: 'https://myapp.com/icon.png',
 * });
 *
 * // Check if already connected (from previous session)
 * if (wallet.isConnected()) {
 *   console.log('Already connected:', wallet.getAddress());
 * }
 *
 * // Listen for connection changes
 * wallet.on('connect', ({ address }) => console.log('Connected:', address));
 * wallet.on('disconnect', () => console.log('Disconnected'));
 *
 * // Connect to wallet (opens popup if not already connected)
 * const { address, chainId } = await wallet.connect();
 *
 * // Send a payment
 * const { hash } = await wallet.sendPayment({
 *   to: '0x...',
 *   amount: 1000000n,
 *   memo: 'Coffee payment',
 * });
 * ```
 */
// Internal config type that requires all fields except callbacks
type InternalConfig = Required<Omit<WalletConnectConfig, 'onConnectionChange'>> & Pick<WalletConnectConfig, 'onConnectionChange'>;

export class WalletConnect {
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
   *
   * @returns true if connected, false otherwise
   *
   * @example
   * ```typescript
   * if (wallet.isConnected()) {
   *   // User is already connected, can make requests
   *   console.log('Connected as:', wallet.getAddress());
   * } else {
   *   // Need to connect first
   *   await wallet.connect();
   * }
   * ```
   */
  isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * Get the connected wallet address
   *
   * @returns The connected address or null if not connected
   *
   * @example
   * ```typescript
   * const address = wallet.getAddress();
   * if (address) {
   *   console.log('Connected as:', address);
   * }
   * ```
   */
  getAddress(): Address | null {
    return this._address;
  }

  /**
   * Get the connected chain ID
   *
   * @returns The connected chain ID or null if not connected
   */
  getChainId(): number | null {
    return this._chainId;
  }

  /**
   * Get the full connection status
   *
   * @returns Object with connection status, address, chainId, and verification state
   *
   * @example
   * ```typescript
   * const { isConnected, address, chainId, verified } = wallet.getConnectionStatus();
   * if (isConnected && !verified) {
   *   // Connection restored from storage but not verified with wallet yet
   * }
   * ```
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
   *
   * A connection is "verified" when it's been confirmed with the wallet,
   * either through a fresh connect() call or verifyConnection().
   *
   * A connection restored from localStorage is NOT verified until checked.
   *
   * @returns true if connection is verified, false if restored but unverified
   */
  isConnectionVerified(): boolean {
    return this._connectionVerified;
  }

  // ============================================================================
  // Event Listeners
  // ============================================================================

  /**
   * Add an event listener for connection events
   *
   * @param event - The event type ('connect' or 'disconnect')
   * @param listener - The callback function
   *
   * @example
   * ```typescript
   * wallet.on('connect', ({ address, chainId }) => {
   *   console.log('Connected:', address, 'on chain', chainId);
   * });
   *
   * wallet.on('disconnect', () => {
   *   console.log('Disconnected');
   * });
   * ```
   */
  on(event: ConnectionEventType, listener: ConnectionEventListener): void {
    this.eventListeners.get(event)?.add(listener);
  }

  /**
   * Remove an event listener
   *
   * @param event - The event type
   * @param listener - The callback function to remove
   */
  off(event: ConnectionEventType, listener: ConnectionEventListener): void {
    this.eventListeners.get(event)?.delete(listener);
  }

  /**
   * Emit an event to all listeners
   */
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

  /**
   * Restore connection from localStorage
   */
  private restoreConnection(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const state: ConnectionState = JSON.parse(stored);

      // Validate the stored state matches current wallet URL
      if (state.walletUrl !== this.config.walletUrl) {
        this.clearStoredConnection();
        return;
      }

      // Restore the connection state
      this._isConnected = true;
      this._address = state.address;
      this._chainId = state.chainId;

      console.log('[WalletConnect] Restored connection:', state.address);
    } catch (err) {
      console.warn('[WalletConnect] Failed to restore connection:', err);
      this.clearStoredConnection();
    }
  }

  /**
   * Save connection to localStorage
   */
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
      console.warn('[WalletConnect] Failed to save connection:', err);
    }
  }

  /**
   * Clear stored connection
   */
  private clearStoredConnection(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn('[WalletConnect] Failed to clear connection:', err);
    }
  }

  // ============================================================================
  // Message Handling
  // ============================================================================

  /**
   * Set up the postMessage listener for wallet responses
   */
  private setupMessageListener(): void {
    if (this.messageHandler) return;

    this.messageHandler = (event: MessageEvent) => {
      // Validate origin
      const walletOrigin = new URL(this.config.walletUrl).origin;
      if (event.origin !== walletOrigin) return;

      const message = event.data as WalletConnectMessage;

      // Handle wallet ready signal
      if (message.type === 'TEMPO_WALLET_READY') {
        console.log('[WalletConnect] Wallet is ready');
        return;
      }

      // Handle response
      if (message.type === 'TEMPO_WALLET_RESPONSE' && message.payload) {
        const response = message.payload as WalletConnectResponse;
        const pending = this.pendingRequests.get(response.id);

        if (pending) {
          this.pendingRequests.delete(response.id);

          if (response.success) {
            pending.resolve(response.result);
          } else {
            // Create error with code for programmatic handling
            const errorCode = response.errorCode || WalletConnectErrorCode.UNKNOWN;
            const error = new WalletConnectError(
              errorCode,
              response.error || 'Request failed'
            );

            // If connection was revoked, update local state
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
   * Clean up resources
   */
  public destroy(): void {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }

    if (this.walletWindow && !this.walletWindow.closed) {
      this.walletWindow.close();
    }

    this.pendingRequests.clear();
    this.eventListeners.clear();
  }

  /**
   * Open wallet window/popup
   */
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

  /**
   * Send a request to the wallet and wait for response
   */
  private async sendRequest<T>(
    path: string,
    method: string,
    params: unknown,
    timeout: number
  ): Promise<T> {
    const requestId = generateRequestId();

    // Open wallet window
    this.walletWindow = this.openWalletWindow(path);

    // Create promise for response
    const responsePromise = new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      // Set timeout
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new WalletConnectError(WalletConnectErrorCode.REQUEST_TIMEOUT, 'Request timed out'));
        }
      }, timeout);
    });

    // Wait for wallet to be ready
    await new Promise(resolve => setTimeout(resolve, 500));

    // Create message
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

    // Keep trying to send until wallet is ready
    const sendMessage = () => {
      if (this.walletWindow && !this.walletWindow.closed) {
        try {
          this.walletWindow.postMessage(message, this.config.walletUrl);
        } catch {
          // Wallet might not be ready yet
        }
      }
    };

    sendMessage();
    const retryInterval = setInterval(sendMessage, 500);

    // Poll for window close - detect when user closes the popup without responding
    const windowCloseInterval = setInterval(() => {
      if (this.walletWindow?.closed && this.pendingRequests.has(requestId)) {
        // The wallet's beforeunload handler should have sent a response via postMessage,
        // wait a short time to allow the message to arrive before rejecting
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

  /**
   * Connect to the wallet
   *
   * If already connected (from a previous session), verifies the connection
   * is still valid before returning. Otherwise, opens the wallet popup for
   * user authentication.
   *
   * @param options - Optional connection options
   * @param options.force - Force a new connection even if already connected
   * @param options.skipVerification - Skip verification of cached connection (faster but may be stale)
   * @returns Connection result with address and chainId
   * @throws Error if user rejects or connection times out
   *
   * @example
   * ```typescript
   * // Connect (verifies cached connection if available)
   * const { address, chainId } = await wallet.connect();
   *
   * // Force a new connection (ignore stored state)
   * const { address, chainId } = await wallet.connect({ force: true });
   *
   * // Quick connect without verification (for UI that will verify later)
   * const { address, chainId } = await wallet.connect({ skipVerification: true });
   * ```
   */
  async connect(options?: { force?: boolean; skipVerification?: boolean }): Promise<ConnectionResult> {
    // If we have a cached connection and not forcing
    if (this._isConnected && this._address && this._chainId && !options?.force) {
      // If already verified this session, return immediately
      if (this._connectionVerified) {
        return {
          address: this._address,
          chainId: this._chainId,
        };
      }

      // If skip verification requested, return cached state
      if (options?.skipVerification) {
        return {
          address: this._address,
          chainId: this._chainId,
        };
      }

      // Verify the cached connection is still valid
      const isValid = await this.verifyConnection();
      if (isValid) {
        return {
          address: this._address!,
          chainId: this._chainId!,
        };
      }
      // Connection was revoked, fall through to request new connection
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

    // Update state
    this._isConnected = true;
    this._address = result.address;
    this._chainId = result.chainId;
    this._connectionVerified = true; // Fresh connection is verified

    // Persist connection
    this.saveConnection(result.address, result.chainId);

    // Emit connect event
    this.emit('connect');

    // Notify via callback
    if (this.onConnectionChange) {
      this.onConnectionChange({ isConnected: true, address: result.address });
    }

    return result;
  }

  /**
   * Disconnect from the wallet
   *
   * Clears the connection state and removes stored connection.
   *
   * @example
   * ```typescript
   * wallet.disconnect();
   * console.log(wallet.isConnected()); // false
   * ```
   */
  disconnect(): void {
    this._isConnected = false;
    this._address = null;
    this._chainId = null;

    // Clear stored connection
    this.clearStoredConnection();

    // Close wallet window if open
    if (this.walletWindow && !this.walletWindow.closed) {
      this.walletWindow.close();
    }

    // Emit disconnect event
    this.emit('disconnect');
  }

  /**
   * Verify the connection is still valid with the wallet
   *
   * This method checks if the connection is still authorized by the wallet.
   * Use this before making important transactions to ensure the connection
   * hasn't been revoked.
   *
   * @returns True if still connected and authorized, false otherwise
   * @throws WalletConnectError if verification fails
   *
   * @example
   * ```typescript
   * // Check connection before sending payment
   * const isValid = await wallet.verifyConnection();
   * if (!isValid) {
   *   // Connection was revoked, prompt user to reconnect
   *   await wallet.connect({ force: true });
   * }
   * ```
   */
  async verifyConnection(): Promise<boolean> {
    if (!this._isConnected || !this._address) {
      this._connectionVerified = true; // Verified as not connected
      return false;
    }

    try {
      // Send a lightweight verify request to the wallet
      const result = await this.sendRequest<{ valid: boolean; address?: Address }>(
        '/connect',
        'verify_connection',
        { address: this._address },
        10000 // 10 second timeout for verification
      );

      if (!result.valid) {
        // Connection was revoked
        this.handleRevocation();
        return false;
      }

      // Connection is valid
      this._connectionVerified = true;
      return true;
    } catch (err) {
      // If verification fails due to popup blocked or timeout, assume still connected
      // but if it's a connection error, update state
      if (err instanceof WalletConnectError) {
        if (
          err.code === WalletConnectErrorCode.NOT_CONNECTED ||
          err.code === WalletConnectErrorCode.CONNECTION_REVOKED
        ) {
          this.handleRevocation();
          return false;
        }
      }
      // For other errors (popup blocked, timeout), return current state
      return this._isConnected;
    }
  }

  /**
   * Handle connection revocation - clear state and notify
   */
  private handleRevocation(): void {
    const wasConnected = this._isConnected;
    this._isConnected = false;
    this._address = null;
    this._chainId = null;
    this._connectionVerified = true; // Verified as revoked
    this.clearStoredConnection();
    this.emit('disconnect');

    // Notify via callback
    if (wasConnected && this.onConnectionChange) {
      this.onConnectionChange({ isConnected: false, address: null, wasRevoked: true });
    }
  }

  /**
   * Ensure connection is valid before making a request
   * @throws WalletConnectError if not connected
   */
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
   * Sign a message
   *
   * @param message - The message to sign
   * @returns Signature result
   * @throws WalletConnectError if not connected or signing fails
   */
  async signMessage(message: string): Promise<SignMessageResult> {
    this.ensureConnected();

    if (!message || typeof message !== 'string') {
      throw new WalletConnectError(
        WalletConnectErrorCode.INVALID_PARAMS,
        'Message must be a non-empty string'
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
  // Transaction Methods (Tempo SDK Compatible)
  // ============================================================================

  /**
   * Send a payment
   *
   * Uses the same parameters as `useTempo().sendPayment` from Gateway.
   *
   * @param params - Payment parameters (same as tempo.ts)
   * @returns Transaction hash
   * @throws WalletConnectError with specific error code if validation fails
   *
   * @example
   * ```typescript
   * const { hash } = await wallet.sendPayment({
   *   to: '0x1234...',
   *   amount: 1000000n, // 1 USD (6 decimals)
   *   memo: 'Coffee payment',
   * });
   * ```
   */
  async sendPayment(params: SendPaymentParams): Promise<TransactionResult> {
    // Validate connection
    this.ensureConnected();

    const { to, amount, token, feeToken, memo } = params;

    // Validate recipient address
    if (!isValidAddress(to)) {
      throw new WalletConnectError(
        WalletConnectErrorCode.INVALID_ADDRESS,
        'Invalid recipient address',
        { field: 'to', value: to }
      );
    }

    // Validate amount
    if (!isValidAmount(amount)) {
      throw new WalletConnectError(
        WalletConnectErrorCode.INVALID_AMOUNT,
        'Amount must be a positive number',
        { field: 'amount', value: String(amount) }
      );
    }

    // Validate optional token addresses
    if (token && !isValidAddress(token)) {
      throw new WalletConnectError(
        WalletConnectErrorCode.INVALID_ADDRESS,
        'Invalid token address',
        { field: 'token', value: token }
      );
    }

    if (feeToken && !isValidAddress(feeToken)) {
      throw new WalletConnectError(
        WalletConnectErrorCode.INVALID_ADDRESS,
        'Invalid fee token address',
        { field: 'feeToken', value: feeToken }
      );
    }

    return this.sendRequest<TransactionResult>(
      '/sign',
      'send_payment',
      {
        to,
        amount: amount.toString(),
        token: token || DEFAULT_FEE_TOKEN,
        feeToken: feeToken || DEFAULT_FEE_TOKEN,
        memo: memo ? stringToBytes32(memo) : undefined,
      },
      SIGNING_TIMEOUT
    );
  }

  /**
   * Send a scheduled payment
   *
   * Uses the same parameters as `useTempo().sendScheduledPayment` from Gateway.
   *
   * @param params - Scheduled payment parameters
   * @returns Transaction hash
   * @throws WalletConnectError with specific error code if validation fails
   */
  async sendScheduledPayment(params: SendScheduledPaymentParams): Promise<TransactionResult> {
    // Validate connection
    this.ensureConnected();

    const { to, amount, token, feeToken, memo, scheduledFor } = params;

    // Validate recipient address
    if (!isValidAddress(to)) {
      throw new WalletConnectError(
        WalletConnectErrorCode.INVALID_ADDRESS,
        'Invalid recipient address',
        { field: 'to', value: to }
      );
    }

    // Validate amount
    if (!isValidAmount(amount)) {
      throw new WalletConnectError(
        WalletConnectErrorCode.INVALID_AMOUNT,
        'Amount must be a positive number',
        { field: 'amount', value: String(amount) }
      );
    }

    // Validate scheduled time
    if (typeof scheduledFor !== 'number' || scheduledFor <= 0) {
      throw new WalletConnectError(
        WalletConnectErrorCode.INVALID_PARAMS,
        'Scheduled time must be a valid Unix timestamp',
        { field: 'scheduledFor', value: scheduledFor }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    if (scheduledFor <= now) {
      throw new WalletConnectError(
        WalletConnectErrorCode.INVALID_PARAMS,
        'Scheduled time must be in the future',
        { field: 'scheduledFor', value: scheduledFor, now }
      );
    }

    return this.sendRequest<TransactionResult>(
      '/sign',
      'send_scheduled_payment',
      {
        to,
        amount: amount.toString(),
        token: token || DEFAULT_FEE_TOKEN,
        feeToken: feeToken || DEFAULT_FEE_TOKEN,
        memo: memo ? stringToBytes32(memo) : undefined,
        scheduledFor,
      },
      SIGNING_TIMEOUT
    );
  }

  /**
   * Swap tokens via DEX
   *
   * Uses the same parameters as `useTempo().swapTokens` from Gateway.
   *
   * @param params - Swap parameters
   * @returns Transaction hash
   * @throws WalletConnectError with specific error code if validation fails
   *
   * @example
   * ```typescript
   * const { hash } = await wallet.swapTokens({
   *   tokenIn: USD_ADDRESS,
   *   tokenOut: USDC_ADDRESS,
   *   amountIn: 1000000n,
   *   minAmountOut: 990000n, // 1% slippage
   * });
   * ```
   */
  async swapTokens(params: SwapParams): Promise<TransactionResult> {
    // Validate connection
    this.ensureConnected();

    const { tokenIn, tokenOut, amountIn, minAmountOut, feeToken } = params;

    // Validate token addresses
    if (!isValidAddress(tokenIn)) {
      throw new WalletConnectError(
        WalletConnectErrorCode.INVALID_ADDRESS,
        'Invalid tokenIn address',
        { field: 'tokenIn', value: tokenIn }
      );
    }

    if (!isValidAddress(tokenOut)) {
      throw new WalletConnectError(
        WalletConnectErrorCode.INVALID_ADDRESS,
        'Invalid tokenOut address',
        { field: 'tokenOut', value: tokenOut }
      );
    }

    if (tokenIn === tokenOut) {
      throw new WalletConnectError(
        WalletConnectErrorCode.INVALID_PARAMS,
        'Cannot swap token for itself',
        { tokenIn, tokenOut }
      );
    }

    // Validate amounts
    if (!isValidAmount(amountIn)) {
      throw new WalletConnectError(
        WalletConnectErrorCode.INVALID_AMOUNT,
        'amountIn must be a positive number',
        { field: 'amountIn', value: String(amountIn) }
      );
    }

    if (typeof minAmountOut !== 'bigint' || minAmountOut < 0n) {
      throw new WalletConnectError(
        WalletConnectErrorCode.INVALID_AMOUNT,
        'minAmountOut must be a non-negative number',
        { field: 'minAmountOut', value: String(minAmountOut) }
      );
    }

    return this.sendRequest<TransactionResult>(
      '/sign',
      'swap_tokens',
      {
        tokenIn,
        tokenOut,
        amountIn: amountIn.toString(),
        minAmountOut: minAmountOut.toString(),
        feeToken: feeToken || DEFAULT_FEE_TOKEN,
      },
      SIGNING_TIMEOUT
    );
  }

  /**
   * Add liquidity to a pool
   *
   * Uses the same parameters as `useTempo().addLiquidity` from Gateway.
   *
   * @param params - Add liquidity parameters
   * @returns Transaction hash
   * @throws WalletConnectError with specific error code if validation fails
   */
  async addLiquidity(params: AddLiquidityParams): Promise<TransactionResult> {
    // Validate connection
    this.ensureConnected();

    const { userToken, validatorToken, validatorTokenAmount, feeToken } = params;

    // Validate token addresses
    if (!isValidAddress(userToken)) {
      throw new WalletConnectError(
        WalletConnectErrorCode.INVALID_ADDRESS,
        'Invalid userToken address',
        { field: 'userToken', value: userToken }
      );
    }

    if (!isValidAddress(validatorToken)) {
      throw new WalletConnectError(
        WalletConnectErrorCode.INVALID_ADDRESS,
        'Invalid validatorToken address',
        { field: 'validatorToken', value: validatorToken }
      );
    }

    // Validate amount
    if (!isValidAmount(validatorTokenAmount)) {
      throw new WalletConnectError(
        WalletConnectErrorCode.INVALID_AMOUNT,
        'validatorTokenAmount must be a positive number',
        { field: 'validatorTokenAmount', value: String(validatorTokenAmount) }
      );
    }

    return this.sendRequest<TransactionResult>(
      '/sign',
      'add_liquidity',
      {
        userToken,
        validatorToken,
        validatorTokenAmount: validatorTokenAmount.toString(),
        feeToken: feeToken || DEFAULT_FEE_TOKEN,
      },
      SIGNING_TIMEOUT
    );
  }

  /**
   * Remove liquidity from a pool
   *
   * Uses the same parameters as `useTempo().removeLiquidity` from Gateway.
   *
   * @param params - Remove liquidity parameters
   * @returns Transaction hash
   * @throws WalletConnectError with specific error code if validation fails
   */
  async removeLiquidity(params: RemoveLiquidityParams): Promise<TransactionResult> {
    // Validate connection
    this.ensureConnected();

    const { userToken, validatorToken, liquidity, feeToken } = params;

    // Validate token addresses
    if (!isValidAddress(userToken)) {
      throw new WalletConnectError(
        WalletConnectErrorCode.INVALID_ADDRESS,
        'Invalid userToken address',
        { field: 'userToken', value: userToken }
      );
    }

    if (!isValidAddress(validatorToken)) {
      throw new WalletConnectError(
        WalletConnectErrorCode.INVALID_ADDRESS,
        'Invalid validatorToken address',
        { field: 'validatorToken', value: validatorToken }
      );
    }

    // Validate liquidity amount
    if (!isValidAmount(liquidity)) {
      throw new WalletConnectError(
        WalletConnectErrorCode.INVALID_AMOUNT,
        'liquidity must be a positive number',
        { field: 'liquidity', value: String(liquidity) }
      );
    }

    return this.sendRequest<TransactionResult>(
      '/sign',
      'remove_liquidity',
      {
        userToken,
        validatorToken,
        liquidity: liquidity.toString(),
        feeToken: feeToken || DEFAULT_FEE_TOKEN,
      },
      SIGNING_TIMEOUT
    );
  }
}
