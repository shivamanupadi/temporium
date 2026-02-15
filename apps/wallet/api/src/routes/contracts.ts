import { Hono } from 'hono';
import type { Env, Variables } from '../types/env';

const contractsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /contracts
 * Returns contract addresses and chain info
 */
contractsRouter.get('/', c => {
  const { chain, rpcUrl, explorerUrl, passkeyRegistryAddress } = c.get('networkConfig');

  return c.json({
    success: true,
    data: {
      chain: {
        id: chain.id,
        name: chain.name,
        rpcUrl,
        explorerUrl,
      },
      contracts: {
        passkeyRegistry: {
          address: passkeyRegistryAddress,
          name: 'PasskeyRegistry',
          description: 'Stores WebAuthn/Passkey public keys on-chain',
          explorerUrl: `${explorerUrl}/address/${passkeyRegistryAddress}`,
        },
        accountKeychain: {
          address: '0xaAAAaaAA00000000000000000000000000000000',
          name: 'AccountKeychain',
          description: 'Precompile for account key management',
          explorerUrl: `${explorerUrl}/address/0xaAAAaaAA00000000000000000000000000000000`,
        },
      },
    },
  });
});

export default contractsRouter;
