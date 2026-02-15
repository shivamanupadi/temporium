import { tempoModerato, tempo } from 'viem/chains';
import type { Chain } from 'viem';

type TempoNetwork = 'testnet' | 'mainnet';

const chains: Record<TempoNetwork, Chain> = {
  testnet: tempoModerato,
  mainnet: tempo,
};

/**
 * Resolve the Tempo chain from a TEMPO_NETWORK env var ("testnet" | "mainnet").
 */
export function getTempoChain(network: string): Chain {
  const chain = chains[network as TempoNetwork];
  if (!chain) {
    throw new Error(`Unknown TEMPO_NETWORK: ${network}. Expected "testnet" or "mainnet".`);
  }
  return chain;
}

/**
 * Derive the default RPC URL from a viem Chain.
 */
export function getRpcUrl(chain: Chain): string {
  return chain.rpcUrls.default.http[0];
}

/**
 * Derive the default block explorer URL from a viem Chain.
 */
export function getExplorerUrl(chain: Chain): string {
  return chain.blockExplorers?.default.url ?? '';
}
