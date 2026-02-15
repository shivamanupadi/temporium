import type { Address } from 'viem';
import { tempoModerato } from 'viem/chains';

export const WALLET_URL = import.meta.env.VITE_WALLET_URL || 'http://localhost:4009';
export const RPC_URL = import.meta.env.VITE_RPC_URL || 'https://rpc.moderato.tempo.xyz';

export const DEFAULT_FEE_TOKEN = '0x20c0000000000000000000000000000000000001' as Address;

export const TEMPO_CHAIN = tempoModerato.extend({ feeToken: DEFAULT_FEE_TOKEN });

export const KNOWN_TOKENS: Record<string, { symbol: string; name: string; address: Address; decimals: number }> = {
  USD: {
    symbol: 'USD',
    name: 'AlphaUSD',
    address: '0x20c0000000000000000000000000000000000001' as Address,
    decimals: 6,
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x20c0000000000000000000000000000000000002' as Address,
    decimals: 6,
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0x20c0000000000000000000000000000000000003' as Address,
    decimals: 6,
  },
};
