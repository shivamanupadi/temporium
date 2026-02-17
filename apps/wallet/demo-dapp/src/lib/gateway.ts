import { WalletConnect } from '@temporium/wallet-connect';
import { WALLET_URL, RPC_URL, TEMPO_CHAIN } from './constants';

let instance: WalletConnect | null = null;

export function getGateway(): WalletConnect {
  if (!instance) {
    instance = new WalletConnect({
      appName: 'Gateway Test dApp',
      appIcon: '',
      appDescription: 'Test application for the Gateway Connect SDK',
      walletUrl: WALLET_URL,
      rpcUrl: RPC_URL,
      chain: TEMPO_CHAIN,
      permissions: ['connect', 'sign', 'send'],
    });
  }
  return instance;
}
