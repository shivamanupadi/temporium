import type { Address } from 'viem';
import { tempoModerato, tempo } from 'viem/chains';

export const TEMPO_NETWORK = (import.meta.env.VITE_TEMPO_NETWORK || 'testnet') as
  | 'testnet'
  | 'mainnet';
export const isTestnet = TEMPO_NETWORK !== 'mainnet';

export const tempoBaseChain = TEMPO_NETWORK === 'mainnet' ? tempo : tempoModerato;

export const DEFAULT_FEE_TOKEN_ADDRESS = '0x20c0000000000000000000000000000000000001' as Address;

export const LINKS = {
  faucet: 'https://docs.tempo.xyz/quickstart/faucet',
  explorer: tempoBaseChain.blockExplorers?.default.url ?? 'https://explore.moderato.tempo.xyz',
  docs: 'https://docs.tempo.xyz',
} as const;

export const TIMING = {
  COPY_FEEDBACK_MS: 2000,
  DEBOUNCE_MS: 300,
  AUTOSAVE_DEBOUNCE_MS: 1000,
  BALANCE_REFRESH_MS: 10000,
} as const;

export const SOLC_VERSION = '0.8.28';
