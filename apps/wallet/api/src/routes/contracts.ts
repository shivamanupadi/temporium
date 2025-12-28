import { Hono } from 'hono';
import type { Env, Variables } from '../types/env';

const contractsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /contracts
 * Returns contract addresses and chain info
 */
contractsRouter.get('/', c => {
  const passkeyRegistryAddress = c.env.PASSKEY_REGISTRY_ADDRESS;
  const rpcUrl = c.env.TEMPO_RPC_URL;

  return c.json({
    success: true,
    data: {
      chain: {
        id: 42429,
        name: 'Tempo Testnet',
        rpcUrl,
        explorerUrl: 'https://explore.tempo.xyz',
      },
      contracts: {
        passkeyRegistry: {
          address: passkeyRegistryAddress,
          name: 'PasskeyRegistry',
          description: 'Stores WebAuthn/Passkey public keys on-chain',
          explorerUrl: `https://explore.tempo.xyz/address/${passkeyRegistryAddress}`,
        },
        accountKeychain: {
          address: '0xaAAAaaAA00000000000000000000000000000000',
          name: 'AccountKeychain',
          description: 'Precompile for account key management',
          explorerUrl:
            'https://explore.tempo.xyz/address/0xaAAAaaAA00000000000000000000000000000000',
        },
      },
    },
  });
});

export default contractsRouter;
