import type { Address } from 'viem';

/**
 * Pastel color scheme for tokens
 */
export interface TokenColors {
  bg: string;
  text: string;
}

const TOKEN_COLORS: Record<string, TokenColors> = {
  pathUSD: { bg: '#EDE9FE', text: '#7C3AED' }, // Pastel violet
  AlphaUSD: { bg: '#D1FAE5', text: '#059669' }, // Pastel green
  BetaUSD: { bg: '#DBEAFE', text: '#2563EB' }, // Pastel blue
  ThetaUSD: { bg: '#FEF3C7', text: '#D97706' }, // Pastel amber
};

const DEFAULT_TOKEN_COLORS: TokenColors = { bg: '#F3F4F6', text: '#6B7280' };

/**
 * Get pastel colors for a token by symbol
 */
export function getTokenColors(symbol: string): TokenColors {
  return TOKEN_COLORS[symbol] || DEFAULT_TOKEN_COLORS;
}

export interface Token {
  name: string;
  symbol: string;
  decimals: number;
  chainId: number;
  address: Address;
  logoURI: string;
  extensions?: {
    chain: string;
  };
}

export interface TokenList {
  name: string;
  logoURI: string;
  timestamp: string;
  version: {
    major: number;
    minor: number;
    patch: number;
  };
  tokens: Token[];
}

/**
 * Static tokenlist data from https://tokenlist.tempo.xyz/list/42429
 * Bundled to avoid CORS issues with client-side fetching
 */
const STATIC_TOKENLIST: TokenList = {
  $schema: 'https://esm.sh/gh/uniswap/token-lists/src/tokenlist.schema.json',
  name: 'Tempo Testnet',
  logoURI: 'https://esm.sh/gh/tempoxyz/tokenlist/data/42429/icon.svg',
  timestamp: '2025-12-06T00:00:00Z',
  version: {
    major: 1,
    minor: 0,
    patch: 0,
  },
  tokens: [
    {
      name: 'pathUSD',
      symbol: 'pathUSD',
      decimals: 6,
      chainId: 42429,
      address: '0x20c0000000000000000000000000000000000000' as Address,
      logoURI: '',
      extensions: {
        chain: 'tempo',
      },
    },
    {
      name: 'AlphaUSD',
      symbol: 'AlphaUSD',
      decimals: 6,
      chainId: 42429,
      address: '0x20c0000000000000000000000000000000000001' as Address,
      logoURI: '',
      extensions: {
        chain: 'tempo',
      },
    },
    {
      name: 'BetaUSD',
      symbol: 'BetaUSD',
      decimals: 6,
      chainId: 42429,
      address: '0x20c0000000000000000000000000000000000002' as Address,
      logoURI: '',
      extensions: {
        chain: 'tempo',
      },
    },
    {
      name: 'ThetaUSD',
      symbol: 'ThetaUSD',
      decimals: 6,
      chainId: 42429,
      address: '0x20c0000000000000000000000000000000000003' as Address,
      logoURI: '',
      extensions: {
        chain: 'tempo',
      },
    },
  ],
} as TokenList;

// Token map for quick lookups
const tokenMap = new Map<string, Token>();
for (const token of STATIC_TOKENLIST.tokens) {
  tokenMap.set(token.address.toLowerCase(), token);
  tokenMap.set(token.symbol.toLowerCase(), token);
}

/**
 * Get the full tokenlist
 */
export function getTokenList(): TokenList {
  return STATIC_TOKENLIST;
}

/**
 * Get all tokens from the tokenlist
 */
export function getTokens(): Token[] {
  return STATIC_TOKENLIST.tokens;
}

/**
 * Get a single token by address
 */
export function getTokenByAddress(address: Address): Token | null {
  return tokenMap.get(address.toLowerCase()) || null;
}

/**
 * Get a single token by symbol
 */
export function getTokenBySymbol(symbol: string): Token | null {
  return tokenMap.get(symbol.toLowerCase()) || null;
}

/**
 * Get the default token (AlphaUSD)
 */
export function getDefaultToken(): Token {
  return STATIC_TOKENLIST.tokens.find(t => t.symbol === 'AlphaUSD') || STATIC_TOKENLIST.tokens[0];
}
