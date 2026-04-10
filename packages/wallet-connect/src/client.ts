import type { Address, Chain, Hex, Account, HttpTransport, WalletClient } from 'viem';
import { createWalletClient, custom, toHex } from 'viem';
import { Provider, dialog, Dialog } from 'accounts';
import type {
  WalletConnectConfig,
  ConnectionResult,
  ConnectionEventType,
  ConnectionEventListener,
} from './types';

const DEFAULT_WALLET_URL = 'https://wallet.temporium.xyz';

/**
 * Connects dApps to Temporium Wallet via the accounts SDK Dialog adapter.
 *
 * Opens the wallet's /embed route in a popup where the user authenticates
 * with their passkey. All signing happens inside the popup via the
 * accounts SDK Remote protocol.
 *
 * @example
 * ```typescript
 * const wallet = new WalletConnect({ appName: 'My App', chain: tempoModerato });
 * await wallet.connect();
 *
 * const walletClient = wallet.getWalletClient();
 * const hash = await Actions.token.transfer(walletClient, { token, to, amount, feeToken });
 * ```
 */
export class WalletConnect {
  private config: WalletConnectConfig;
  private provider: ReturnType<typeof Provider.create> | null = null;
  private _isConnected = false;
  private _address: Address | null = null;
  private _chainId: number | null = null;
  private listeners = new Map<ConnectionEventType, Set<ConnectionEventListener>>();

  constructor(config: WalletConnectConfig) {
    this.config = config;
    this.listeners.set('connect', new Set());
    this.listeners.set('disconnect', new Set());
  }

  private getProvider(): ReturnType<typeof Provider.create> {
    if (!this.provider) {
      const embedUrl = `${this.config.walletUrl || DEFAULT_WALLET_URL}/embed`;

      this.provider = Provider.create({
        adapter: dialog({
          host: embedUrl,
          name: 'Temporium Wallet',
          rdns: 'xyz.temporium.wallet',
          dialog: Dialog.popup({ size: { width: 420, height: 600 } }),
        }),
        ...(this.config.chain ? { chains: [this.config.chain] as any } : {}),
        persistCredentials: true,
      });

      this.provider.on('accountsChanged', (accounts: readonly Address[]) => {
        if (accounts.length > 0) this._address = accounts[0];
      });

      this.provider.on('disconnect', () => {
        this._isConnected = false;
        this._address = null;
        this._chainId = null;
        this.emit('disconnect');
        this.config.onConnectionChange?.({ isConnected: false, address: null });
      });
    }
    return this.provider;
  }

  async connect(): Promise<ConnectionResult> {
    const provider = this.getProvider();

    const accounts = await provider.request({ method: 'eth_requestAccounts' }) as Address[];
    const chainIdHex = await provider.request({ method: 'eth_chainId' }) as string;

    this._isConnected = true;
    this._address = accounts[0];
    this._chainId = Number(chainIdHex);

    this.emit('connect');
    this.config.onConnectionChange?.({ isConnected: true, address: this._address });

    return { address: this._address, chainId: this._chainId };
  }

  disconnect(): void {
    if (this.provider) {
      this.provider.request({ method: 'wallet_disconnect' }).catch(() => {});
    }
    this._isConnected = false;
    this._address = null;
    this._chainId = null;
    this.emit('disconnect');
    this.config.onConnectionChange?.({ isConnected: false, address: null });
  }

  async signMessage(message: string): Promise<{ signature: Hex }> {
    if (!this._isConnected || !this._address) throw new Error('Not connected');

    const hexMessage = message.startsWith('0x') ? (message as Hex) : toHex(message);
    const signature = (await this.getProvider().request({
      method: 'personal_sign',
      params: [hexMessage, this._address],
    })) as unknown as Hex;

    return { signature };
  }

  getWalletClient(): WalletClient<HttpTransport, Chain, Account> {
    if (!this._isConnected || !this._address || !this.config.chain) {
      throw new Error('Not connected or chain not configured');
    }

    return createWalletClient({
      account: this._address,
      chain: this.config.chain,
      transport: custom(this.getProvider()),
    }) as unknown as WalletClient<HttpTransport, Chain, Account>;
  }

  async verifyConnection(): Promise<boolean> {
    if (!this._isConnected) return false;
    try {
      const accounts = (await this.getProvider().request({ method: 'eth_accounts' })) as Address[];
      return accounts.length > 0;
    } catch {
      return false;
    }
  }

  isConnectionVerified(): boolean {
    return this._isConnected;
  }

  isConnected(): boolean {
    return this._isConnected;
  }

  getAddress(): Address | null {
    return this._address;
  }

  getChainId(): number | null {
    return this._chainId;
  }

  getConnectionStatus(): {
    isConnected: boolean;
    address: Address | null;
    chainId: number | null;
  } {
    return {
      isConnected: this._isConnected,
      address: this._address,
      chainId: this._chainId,
    };
  }

  on(event: ConnectionEventType, listener: ConnectionEventListener): void {
    this.listeners.get(event)?.add(listener);
  }

  off(event: ConnectionEventType, listener: ConnectionEventListener): void {
    this.listeners.get(event)?.delete(listener);
  }

  private emit(type: ConnectionEventType): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ type, address: this._address, chainId: this._chainId });
    }
  }
}
