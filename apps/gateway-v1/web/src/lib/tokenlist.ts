import type { Address } from 'viem';
import { TOKENLIST_API_URL, TEMPO_NETWORK } from './api';
import { tempoBaseChain } from './constants';

const CHAIN_ID = tempoBaseChain.id;

export interface TokenColors {
  bg: string;
  text: string;
}

const TOKEN_COLORS: Record<string, TokenColors> = {
  pathUSD: { bg: '#EDE9FE', text: '#7C3AED' },
  AlphaUSD: { bg: '#D1FAE5', text: '#059669' },
  BetaUSD: { bg: '#DBEAFE', text: '#2563EB' },
  ThetaUSD: { bg: '#FEF3C7', text: '#D97706' },
};

const DEFAULT_TOKEN_COLORS: TokenColors = { bg: '#F3F4F6', text: '#6B7280' };

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

let cachedTokenList: TokenList | null = null;
let tokenMap = new Map<string, Token>();

async function fetchTokenList(): Promise<TokenList> {
  if (cachedTokenList) {
    return cachedTokenList;
  }

  const response = await fetch(`${TOKENLIST_API_URL}/list/${CHAIN_ID}`, {
    headers: { 'X-Tempo-Network': TEMPO_NETWORK },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch tokenlist: ${response.status}`);
  }

  const data = await response.json();
  cachedTokenList = data as TokenList;

  tokenMap = new Map<string, Token>();
  for (const token of cachedTokenList.tokens) {
    tokenMap.set(token.address.toLowerCase(), token);
    tokenMap.set(token.symbol.toLowerCase(), token);
  }

  return cachedTokenList;
}

export async function getTokens(): Promise<Token[]> {
  const list = await fetchTokenList();
  return list.tokens;
}

export async function getTokenByAddress(address: Address): Promise<Token | null> {
  await fetchTokenList();
  return tokenMap.get(address.toLowerCase()) || null;
}

export async function getTokenBySymbol(symbol: string): Promise<Token | null> {
  await fetchTokenList();
  return tokenMap.get(symbol.toLowerCase()) || null;
}
