import type { Context, Next } from 'hono';
import { getTempoChain, getRpcUrl, getExplorerUrl } from '../lib/chain';
import type { Env, Variables, NetworkConfig } from '../types/env';

type TempoNetwork = 'testnet' | 'mainnet';

const VALID_NETWORKS: ReadonlySet<string> = new Set(['testnet', 'mainnet']);

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
  const chain = getTempoChain(network);
  const rpcUrl = getRpcUrl(chain);
  const explorerUrl = getExplorerUrl(chain);

  const recurringPaymentsAddress =
    network === 'mainnet'
      ? c.env.MAINNET_RECURRING_PAYMENTS_ADDRESS
      : c.env.TESTNET_RECURRING_PAYMENTS_ADDRESS;

  const relayerPrivateKey =
    network === 'mainnet' ? c.env.MAINNET_RELAYER_PRIVATE_KEY : c.env.TESTNET_RELAYER_PRIVATE_KEY;

  const networkConfig: NetworkConfig = {
    network,
    chain,
    rpcUrl,
    explorerUrl,
    recurringPaymentsAddress,
    relayerPrivateKey,
  };

  c.set('networkConfig', networkConfig);

  await next();
}
