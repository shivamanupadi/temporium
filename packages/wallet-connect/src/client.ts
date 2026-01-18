import type { Address, Hash, Hex } from 'viem';
import {
  WALLET_CONNECT_VERSION,
  type WalletConnectConfig,
  type ConnectionResult,
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
 * Uses the same parameter types as tempo.ts SDK for seamless integration.
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
 * // Connect to wallet
 * const { address, chainId } = await wallet.connect();
 *
 * // Send a payment (same params as useTempo().sendPayment)
 * const { hash } = await wallet.sendPayment({
 *   to: '0x...',
 *   amount: 1000000n, // 1 USD
 *   memo: 'Coffee payment',
 * });
 *
 * // Swap tokens (same params as useTempo().swapTokens)
 * const { hash } = await wallet.swapTokens({
 *   tokenIn: '0x...',
 *   tokenOut: '0x...',
 *   amountIn: 1000000n,
 *   minAmountOut: 990000n,
 * });
 * ```
 */
export class WalletConnect {
  private config: Required<WalletConnectConfig>;
  private walletWindow: Window | null = null;
  private pendingRequests: Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  > = new Map();
  private isConnected = false;
  private connectedAddress: Address | null = null;
  private messageHandler: ((event: MessageEvent) => void) | null = null;

  constructor(config: WalletConnectConfig) {
    this.config = {
      appName: config.appName,
      appUrl: config.appUrl || (typeof window !== 'undefined' ? window.location.origin : ''),
      appIcon: config.appIcon || '',
      appDescription: config.appDescription || '',
      walletUrl: config.walletUrl || DEFAULT_WALLET_URL,
      permissions: config.permissions || ['connect', 'sign', 'send'],
    };

    // Set up message listener
    if (typeof window !== 'undefined') {
      this.setupMessageListener();
    }
  }

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
            pending.reject(new Error(response.error || 'Request failed'));
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
      throw new Error('Failed to open wallet popup. Please allow popups for this site.');
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
          reject(new Error('Request timed out'));
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

    responsePromise.finally(() => {
      clearInterval(retryInterval);
    });

    return responsePromise;
  }

  // ============================================================================
  // Connection Methods
  // ============================================================================

  /**
   * Connect to the wallet
   *
   * @returns Connection result with address and chainId
   * @throws Error if user rejects or connection times out
   */
  async connect(): Promise<ConnectionResult> {
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

    this.isConnected = true;
    this.connectedAddress = result.address;

    return result;
  }

  /**
   * Disconnect from the wallet
   */
  disconnect(): void {
    this.isConnected = false;
    this.connectedAddress = null;

    if (this.walletWindow && !this.walletWindow.closed) {
      this.walletWindow.close();
    }
  }

  /**
   * Get the current connection status
   */
  getConnectionStatus(): { isConnected: boolean; address: Address | null } {
    return {
      isConnected: this.isConnected,
      address: this.connectedAddress,
    };
  }

  // ============================================================================
  // Signing Methods
  // ============================================================================

  /**
   * Sign a message
   *
   * @param message - The message to sign
   * @returns Signature result
   */
  async signMessage(message: string): Promise<SignMessageResult> {
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
    const { to, amount, token, feeToken, memo } = params;

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
   */
  async sendScheduledPayment(params: SendScheduledPaymentParams): Promise<TransactionResult> {
    const { to, amount, token, feeToken, memo, scheduledFor } = params;

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
    const { tokenIn, tokenOut, amountIn, minAmountOut, feeToken } = params;

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
   */
  async addLiquidity(params: AddLiquidityParams): Promise<TransactionResult> {
    const { userToken, validatorToken, validatorTokenAmount, feeToken } = params;

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
   */
  async removeLiquidity(params: RemoveLiquidityParams): Promise<TransactionResult> {
    const { userToken, validatorToken, liquidity, feeToken } = params;

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
