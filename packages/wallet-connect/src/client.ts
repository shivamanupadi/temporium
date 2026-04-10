import type { Address, Chain, Hex, Account, HttpTransport, WalletClient } from 'viem';
import { createWalletClient, custom } from 'viem';
import { Provider, dialog, Dialog } from 'accounts';
import type {
  WalletConnectConfig,
  ConnectionResult,
  ConnectionEventType,
  ConnectionEventListener,
} from './types';

/**
 * Default wallet URL
 */
const DEFAULT_WALLET_URL = 'https://wallet.temporium.xyz';

/**
 * WalletConnect — connects dApps to Temporium Wallet via accounts SDK Dialog adapter.
 *
 * Opens the wallet's /embed route in a popup. The wallet handles signing
 * via passkeys through the accounts SDK Remote protocol.
 *
 * @example
 * ```typescript
 * const wallet = new WalletConnect({
 *   appName: 'My App',
 *   chain: tempoModerato,
 * });
 *
 * await wallet.connect();
 * const walletClient = wallet.getWalletClient();
 * const hash = await Actions.token.transfer(walletClient, { ... });
 * ```
 */
export class WalletConnect {
  private config: WalletConnectConfig;
  private provider: ReturnType<typeof Provider.create> | null = null;
  private _isConnected = false;
  private _address: Address | null = null;
  private _chainId: number | null = null;
  private eventListeners = new Map<ConnectionEventType, Set<ConnectionEventListener>>();

  constructor(config: WalletConnectConfig) {
    this.config = config;
    this.eventListeners.set('connect', new Set());
    this.eventListeners.set('disconnect', new Set());
  }

  private getWalletUrl(): string {
    return this.config.walletUrl || DEFAULT_WALLET_URL;
  }

  private getProvider(): ReturnType<typeof Provider.create> {
    if (!this.provider) {
      const walletUrl = this.getWalletUrl();
      const embedUrl = `${walletUrl}/embed`;

      this.provider = Provider.create({
        adapter: dialog({
          host: embedUrl,
          name: 'Temporium Wallet',
          rdns: 'xyz.temporium.wallet',
          dialog: Dialog.popup({ size: { width: 420, height: 600 } }),
        }),
        chains: this.config.chain ? [this.config.chain] as any : undefined,
        persistCredentials: true,
      });

      // Forward events
      this.provider.on('accountsChanged', (accounts: readonly Address[]) => {
        if (accounts.length > 0) {
          this._address = accounts[0];
        }
      });

      this.provider.on('disconnect', () => {
        this._isConnected = false;
        this._address = null;
        this._chainId = null;
        this.emit('disconnect');
        this.config.onConnectionChange?.({
          isConnected: false,
          address: null,
        });
      });
    }
    return this.provider;
  }

  /**
   * Connect to the wallet. Opens the wallet popup for user authentication.
   */
  async connect(): Promise<ConnectionResult> {
    const provider = this.getProvider();

    const accounts = await provider.request({
      method: 'eth_requestAccounts',
    }) as Address[];

    const chainIdHex = await provider.request({
      method: 'eth_chainId',
    }) as string;

    this._isConnected = true;
    this._address = accounts[0];
    this._chainId = Number(chainIdHex);

    this.emit('connect');
    this.config.onConnectionChange?.({
      isConnected: true,
      address: this._address,
    });

    return {
      address: this._address,
      chainId: this._chainId,
    };
  }

  /**
   * Disconnect from the wallet.
   */
  disconnect(): void {
    if (this.provider) {
      this.provider.request({ method: 'wallet_disconnect' }).catch(() => {});
    }
    this._isConnected = false;
    this._address = null;
    this._chainId = null;
    this.emit('disconnect');
    this.config.onConnectionChange?.({
      isConnected: false,
      address: null,
    });
  }

  /**
   * Sign a message using the connected wallet.
   */
  async signMessage(message: string): Promise<{ signature: Hex }> {
    if (!this._isConnected || !this._address) {
      throw new Error('Not connected');
    }

    const provider = this.getProvider();
    const signature = await provider.request({
      method: 'personal_sign',
      params: [message as Hex, this._address],
    }) as unknown as Hex;

    return { signature };
  }

  /**
   * Get a viem WalletClient backed by the wallet's signing.
   * Use this with tempo.ts Actions.* calls.
   */
  getWalletClient(): WalletClient<HttpTransport, Chain, Account> {
    if (!this._isConnected || !this._address || !this.config.chain) {
      throw new Error('Not connected or chain not configured');
    }

    const provider = this.getProvider();

    return createWalletClient({
      account: this._address,
      chain: this.config.chain,
      transport: custom(provider),
    }) as unknown as WalletClient<HttpTransport, Chain, Account>;
  }

  /**
   * Verify the current connection is still valid.
   */
  async verifyConnection(): Promise<boolean> {
    if (!this._isConnected || !this._address) return false;
    try {
      const provider = this.getProvider();
      const accounts = await provider.request({ method: 'eth_accounts' }) as Address[];
      return accounts.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Check if the connection has been verified.
   */
  isConnectionVerified(): boolean {
    return this._isConnected;
  }

  // --- Query methods ---

  isConnected(): boolean {
    return this._isConnected;
  }

  getAddress(): Address | null {
    return this._address;
  }

  getChainId(): number | null {
    return this._chainId;
  }

  getConnectionStatus() {
    return {
      isConnected: this._isConnected,
      address: this._address,
      chainId: this._chainId,
      verified: this._isConnected,
    };
  }

  // --- Event system ---

  on(event: ConnectionEventType, listener: ConnectionEventListener): void {
    this.eventListeners.get(event)?.add(listener);
  }

  off(event: ConnectionEventType, listener: ConnectionEventListener): void {
    this.eventListeners.get(event)?.delete(listener);
  }

  private emit(type: ConnectionEventType): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      const event = {
        type,
        address: this._address,
        chainId: this._chainId,
      };
      for (const listener of listeners) {
        listener(event);
      }
    }
  }
}
