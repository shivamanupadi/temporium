import type { Context, Next } from 'hono';
import { tempoModerato, tempo } from 'viem/chains';
import type { Chain } from 'viem';
import type { Env, Variables, NetworkConfig } from '../types/env';

type TempoNetwork = 'testnet' | 'mainnet';

const VALID_NETWORKS: ReadonlySet<string> = new Set(['testnet', 'mainnet']);

const chains: Record<TempoNetwork, Chain> = {
  testnet: tempoModerato,
  mainnet: tempo,
};

export async function networkMiddleware(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) {
  const header = c.req.header('X-Tempo-Network') || 'testnet';

  if (!VALID_NETWORKS.has(header)) {
    return c.json(
      {
        success: false,
        error: {
          code: 'INVALID_NETWORK',
          message: `Invalid X-Tempo-Network header: "${header}". Expected "testnet" or "mainnet".`,
        },
      },
      400
    );
  }

  const network = header as TempoNetwork;
  const chain = chains[network];
  const rpcUrl = chain.rpcUrls.default.http[0];
  const explorerUrl = chain.blockExplorers?.default.url ?? '';

  const networkConfig: NetworkConfig = {
    network,
    chain,
    rpcUrl,
    explorerUrl,
  };

  c.set('networkConfig', networkConfig);
  await next();
}
