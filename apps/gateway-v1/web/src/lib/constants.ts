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
 * Scheduling presets (in seconds)
 */
export const SCHEDULE_PRESETS = [
  { label: '5 min', seconds: 5 * 60 },
  { label: '15 min', seconds: 15 * 60 },
  { label: '30 min', seconds: 30 * 60 },
  { label: '1 hour', seconds: 60 * 60 },
] as const;

/**
 * Max scheduling time on testnet
 */
export const MAX_SCHEDULE_SECONDS = 3600;

/**
 * External links
 */
export const LINKS = {
  faucet: 'https://docs.tempo.xyz/quickstart/faucet',
  explorer: tempoBaseChain.blockExplorers?.default.url ?? 'https://explore.moderato.tempo.xyz',
  docs: 'https://docs.tempo.xyz',
  tokenlist: 'https://tokenlist.tempo.xyz',
} as const;

/**
 * Supported currencies for stablecoin creation
 */
export const CURRENCIES = [
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
  { value: 'GBP', label: 'British Pound (GBP)' },
  { value: 'JPY', label: 'Japanese Yen (JPY)' },
  { value: 'CHF', label: 'Swiss Franc (CHF)' },
] as const;

/**
 * Token role options for TIP-20 stablecoins
 */
export const ROLE_OPTIONS = [
  { value: 'issuer', label: 'Issuer (Mint)', description: 'Can mint new tokens' },
  { value: 'pause', label: 'Pause', description: 'Can pause transfers' },
  { value: 'unpause', label: 'Unpause', description: 'Can unpause transfers' },
  { value: 'burnBlocked', label: 'Burn Blocked', description: 'Can burn from blocked addresses' },
  { value: 'defaultAdmin', label: 'Admin', description: 'Full administrative control' },
] as const;

/**
 * Timing constants (in milliseconds)
 */
export const TIMING = {
  COPY_FEEDBACK_MS: 2000,
  DEBOUNCE_MS: 300,
  FAUCET_REFRESH_DELAY_MS: 2000,
  BALANCE_REFRESH_MS: 10000,
  POOL_REFRESH_MS: 15000,
  SCHEDULED_TX_CHECK_MS: 30000,
  COUNTDOWN_INTERVAL_MS: 1000,
} as const;

/**
 * AccountKeychain precompile address
 */
export const ACCOUNT_KEYCHAIN_ADDRESS = '0xaAAAaaAA00000000000000000000000000000000' as Address;

/**
 * Wallet URL for WalletConnect popup
 */
export const WALLET_URL = import.meta.env.VITE_WALLET_URL || 'http://localhost:4004';
