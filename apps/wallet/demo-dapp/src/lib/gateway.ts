import { GatewayConnect } from '@temporium/gateway-connect';
import { WALLET_URL, RPC_URL, TEMPO_CHAIN } from './constants';

let instance: GatewayConnect | null = null;

export function getGateway(): GatewayConnect {
  if (!instance) {
    instance = new GatewayConnect({
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
