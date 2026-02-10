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
  const chainId = Number(c.env.TEMPO_CHAIN_ID);
  const explorerUrl = c.env.TEMPO_EXPLORER_URL;

  return c.json({
    success: true,
    data: {
      chain: {
        id: chainId,
        name: chainId === 4217 ? 'Tempo Mainnet' : 'Tempo Testnet',
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
