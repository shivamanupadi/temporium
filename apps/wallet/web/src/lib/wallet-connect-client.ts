import { WalletConnect } from '@temporium/gateway-connect';
import { WALLET_URL } from './constants';

/**
 * Singleton WalletConnect instance for popup wallet integration.
 * Used when wallet type is 'wallet-connect'.
 */
let walletConnectInstance: WalletConnect | null = null;

export function getWalletConnect(): WalletConnect {
  if (!walletConnectInstance) {
    walletConnectInstance = new WalletConnect({
      appName: 'Temporium Gateway',
      appIcon: `${window.location.origin}/logo-dark.png`,
      appDescription: 'Temporium Gateway: DeFi tools for the Tempo blockchain',
      walletUrl: WALLET_URL,
      permissions: ['connect', 'sign', 'send'],
    });
  }
  return walletConnectInstance;
}

export function destroyWalletConnect(): void {
  if (walletConnectInstance) {
    walletConnectInstance.destroy();
    walletConnectInstance = null;
  }
}
