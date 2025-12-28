import type { Address } from 'viem';

/**
 * Tempo Testnet Configuration
 */
export const TEMPO_TESTNET = {
  id: 42429,
  name: 'Tempo Testnet',
  network: 'tempo-testnet',
  nativeCurrency: {
    name: 'USD',
    symbol: 'USD',
    decimals: 6,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.tempo.xyz'],
      webSocket: ['wss://rpc.testnet.tempo.xyz'],
    },
    public: {
      http: ['https://rpc.testnet.tempo.xyz'],
      webSocket: ['wss://rpc.testnet.tempo.xyz'],
    },
  },
  blockExplorers: {
    default: { name: 'Tempo Explorer', url: 'https://explore.tempo.xyz' },
  },
} as const;

/**
 * Default fee token address (AlphaUSD)
 * This is used when the tokenlist hasn't loaded yet
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
 * Max scheduling time on testnet (approximately 1 hour)
 */
export const MAX_SCHEDULE_SECONDS = 3600;

/**
 * External links
 */
export const LINKS = {
  faucet: 'https://docs.tempo.xyz/quickstart/faucet',
  explorer: 'https://explore.tempo.xyz',
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
  /** How long to show "copied" feedback */
  COPY_FEEDBACK_MS: 2000,
  /** Delay before fetching swap quote */
  DEBOUNCE_MS: 300,
  /** How often to refresh faucet success state */
  FAUCET_REFRESH_DELAY_MS: 2000,
  /** How often to refresh token balances */
  BALANCE_REFRESH_MS: 10000,
  /** How often to refresh pool/liquidity data */
  POOL_REFRESH_MS: 15000,
  /** How often to check scheduled transaction status */
  SCHEDULED_TX_CHECK_MS: 30000,
  /** Countdown update interval */
  COUNTDOWN_INTERVAL_MS: 1000,
} as const;

/**
 * AccountKeychain precompile address
 */
export const ACCOUNT_KEYCHAIN_ADDRESS = '0xaAAAaaAA00000000000000000000000000000000' as Address;

/**
 * PasskeyRegistry contract address
 * Stores WebAuthn/Passkey public keys on-chain
 * Deploy the contract and update this address
 */
export const PASSKEY_REGISTRY_ADDRESS = '0x0000000000000000000000000000000000000000' as Address; // TODO: Update after deployment

/**
 * Access Key signature type mapping (on-chain values)
 */
export const ACCESS_KEY_TYPE_MAP = {
  secp256k1: 0,
  p256: 1,
  webAuthn: 2,
} as const;

/**
 * Reverse mapping from on-chain type to string
 */
export const ACCESS_KEY_TYPE_LABELS: Record<number, string> = {
  0: 'secp256k1',
  1: 'p256',
  2: 'webAuthn',
} as const;
