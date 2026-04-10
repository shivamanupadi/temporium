import { WalletConnect } from '@temporium/wallet-connect';
import { WALLET_URL, TEMPO_CHAIN } from './constants';

let instance: WalletConnect | null = null;

export function getGateway(): WalletConnect {
  if (!instance) {
    instance = new WalletConnect({
      appName: 'Gateway Test dApp',
      appDescription: 'Test application for the Gateway Connect SDK',
      walletUrl: WALLET_URL,
      chain: TEMPO_CHAIN,
    });
  }
  return instance;
}
