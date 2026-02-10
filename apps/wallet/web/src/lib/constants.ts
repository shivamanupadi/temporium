import type { Address } from 'viem';
import { tempoModerato, tempo } from 'viem/chains';

/**
 * Network selection (env-driven)
 */
export const TEMPO_NETWORK = (import.meta.env.VITE_TEMPO_NETWORK || 'testnet') as
  | 'testnet'
  | 'mainnet';
export const isTestnet = TEMPO_NETWORK !== 'mainnet';

/**
 * Selected chain from viem/chains
 */
export const tempoBaseChain = TEMPO_NETWORK === 'mainnet' ? tempo : tempoModerato;

/**
 * Default fee token address (AlphaUSD)
 */
export const DEFAULT_FEE_TOKEN_ADDRESS = '0x20c0000000000000000000000000000000000001' as Address;

/**
 * External links
 */
export const LINKS = {
  faucet: 'https://docs.tempo.xyz/quickstart/faucet',
  explorer: tempoBaseChain.blockExplorers?.default.url ?? 'https://explore.moderato.tempo.xyz',
  docs: 'https://docs.tempo.xyz',
} as const;

/**
 * Timing constants (in milliseconds)
 */
export const TIMING = {
  /** How long to show "copied" feedback */
  COPY_FEEDBACK_MS: 2000,
  /** How often to refresh token balances */
  BALANCE_REFRESH_MS: 10000,
  /** Connection request timeout */
  CONNECTION_TIMEOUT_MS: 60000,
  /** Signing request timeout */
  SIGNING_TIMEOUT_MS: 120000,
} as const;

/**
 * Wallet Connect Protocol Version
 */
export const WALLET_CONNECT_VERSION = '1.0.0';

/**
 * Storage keys
 */
export const STORAGE_KEYS = {
  CONNECTED_APPS: 'temporium_connected_apps',
  PENDING_REQUESTS: 'temporium_pending_requests',
} as const;
