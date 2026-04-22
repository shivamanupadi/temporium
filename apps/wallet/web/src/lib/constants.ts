import type { Address } from 'viem';
import { tempoModerato, tempo } from 'viem/chains';

/**
 * Network selection (localStorage → env fallback)
 */
const NETWORK_STORAGE_KEY = 'temporium_network';

function getStoredNetwork(): 'testnet' | 'mainnet' {
  try {
    const stored = localStorage.getItem(NETWORK_STORAGE_KEY);
    if (stored === 'testnet' || stored === 'mainnet') return stored;
  } catch {
    /* localStorage unavailable */
  }
  return 'mainnet';
}

export const TEMPO_NETWORK = getStoredNetwork();
export const isTestnet = TEMPO_NETWORK !== 'mainnet';

/** Dev mode - enables passkey wallet (hidden from public users). Activated via ?dev=true URL param. */
export const isDevMode = (() => {
  try {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get('dev') === 'true') {
      localStorage.setItem('temporium_dev', 'true');
      return true;
    }
    if (params.get('dev') === 'false') {
      localStorage.removeItem('temporium_dev');
      return false;
    }
    return localStorage.getItem('temporium_dev') === 'true';
  } catch {
    return false;
  }
})();

export function switchNetwork(network: 'testnet' | 'mainnet', clearSession = false): void {
  if (network === TEMPO_NETWORK) return;
  localStorage.setItem(NETWORK_STORAGE_KEY, network);

  if (clearSession) {
    // Clear all session state - forces re-sign-in on the new network
    localStorage.removeItem('wagmi.store');
    localStorage.removeItem('temporium_auth');
    // Clear accounts SDK IDB storage
    try {
      const req = indexedDB.deleteDatabase('tempo');
      req.onsuccess = () => window.location.reload();
      req.onerror = () => window.location.reload();
      req.onblocked = () => window.location.reload();
      return;
    } catch {
      // Fall through to reload
    }
  }

  window.location.reload();
}

/**
 * Selected chain from viem/chains
 */
export const tempoBaseChain = TEMPO_NETWORK === 'mainnet' ? tempo : tempoModerato;

/**
 * Default fee token address - pathUSD is the chain default on both networks.
 * Users can override per-account via FeeManager.setUserToken (Settings page).
 */
export const DEFAULT_FEE_TOKEN_ADDRESS = '0x20c0000000000000000000000000000000000000' as Address;

/**
 * Scheduling presets (in seconds)
 */
export const SCHEDULE_PRESETS = [
  { label: '10 sec', seconds: 10 },
  { label: '30 sec', seconds: 30 },
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
  CONNECTION_TIMEOUT_MS: 60000,
  SIGNING_TIMEOUT_MS: 120000,
} as const;

/**
 * AccountKeychain precompile address
 */
export const ACCOUNT_KEYCHAIN_ADDRESS = '0xaAAAaaAA00000000000000000000000000000000' as Address;

