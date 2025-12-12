import type { Address } from 'viem';
import { TOKENLIST_API_URL } from './api';

const CHAIN_ID = 42429;

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

// Cache for tokenlist
let cachedTokenList: TokenList | null = null;
let tokenMap = new Map<string, Token>();

/**
 * Fetch tokenlist from proxy (bypasses CORS)
 */
async function fetchTokenList(): Promise<TokenList> {
  if (cachedTokenList) {
    return cachedTokenList;
  }

  const response = await fetch(`${TOKENLIST_API_URL}/list/${CHAIN_ID}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch tokenlist: ${response.status}`);
  }

  const data = await response.json();
  cachedTokenList = data as TokenList;

  // Build token map for quick lookups
  tokenMap = new Map<string, Token>();
  for (const token of cachedTokenList.tokens) {
    tokenMap.set(token.address.toLowerCase(), token);
    tokenMap.set(token.symbol.toLowerCase(), token);
  }

  return cachedTokenList;
}

/**
 * Get the full tokenlist
 */
export async function getTokenList(): Promise<TokenList> {
  return fetchTokenList();
}

/**
 * Get all tokens from the tokenlist
 */
export async function getTokens(): Promise<Token[]> {
  const list = await fetchTokenList();
  return list.tokens;
}

/**
 * Get a single token by address
 */
export async function getTokenByAddress(address: Address): Promise<Token | null> {
  await fetchTokenList();
  return tokenMap.get(address.toLowerCase()) || null;
}

/**
 * Get a single token by symbol
 */
export async function getTokenBySymbol(symbol: string): Promise<Token | null> {
  await fetchTokenList();
  return tokenMap.get(symbol.toLowerCase()) || null;
}

/**
 * Get the default token (pathUSD)
 */
export async function getDefaultToken(): Promise<Token> {
  const list = await fetchTokenList();
  return list.tokens.find(t => t.symbol === 'pathUSD') || list.tokens[0];
}
