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
 */
export const DEFAULT_FEE_TOKEN_ADDRESS = '0x20c0000000000000000000000000000000000001' as Address;

/**
 * External links
 */
export const LINKS = {
  faucet: 'https://docs.tempo.xyz/quickstart/faucet',
  explorer: 'https://explore.tempo.xyz',
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
