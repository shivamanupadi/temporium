/**
 * Token resolver for payment links.
 *
 * Any token that appears in the upstream tokenlist for the active network
 * is accepted — we snapshot `{address, symbol, decimals}` onto the payment
 * link row at creation time so the pay page doesn't need a second round-trip,
 * and so links keep working even if the upstream tokenlist later drops or
 * renames the token.
 *
 * The only validation is: the token must exist in the tokenlist for the
 * network the link is being created on. Cross-network addresses are rejected.
 */
import type { Address } from 'viem';
import { BadRequestError, ExternalServiceError } from '../middleware/error';

const TOKENLIST_BASE_URL = 'https://tokenlist.tempo.xyz';

const CHAIN_ID: Record<'testnet' | 'mainnet', number> = {
  testnet: 42431, // tempoModerato
  mainnet: 4217, //  tempo (presto)
};

interface TokenListEntry {
  name: string;
  symbol: string;
  decimals: number;
  chainId: number;
  address: Address;
  logoURI?: string;
}

interface TokenListResponse {
  tokens: TokenListEntry[];
}

export interface ResolvedToken {
  address: Address;
  symbol: string;
  decimals: number;
  logoURI?: string;
}

/**
 * Fetch the upstream tokenlist for the given network and return the entry
 * matching `tokenAddress`. Throws BadRequestError if the token isn't listed
 * for this network, ExternalServiceError if tokenlist.tempo.xyz is down.
 */
export async function resolveAllowedToken(
  tokenAddress: string,
  network: 'testnet' | 'mainnet'
): Promise<ResolvedToken> {
  const chainId = CHAIN_ID[network];
  const url = `${TOKENLIST_BASE_URL}/list/${chainId}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Temporium-API/2.0',
      },
    });
  } catch (err) {
    throw new ExternalServiceError('Failed to reach tokenlist service', 'tokenlist.tempo.xyz');
  }

  if (!response.ok) {
    throw new ExternalServiceError(
      `Tokenlist service responded ${response.status}`,
      'tokenlist.tempo.xyz'
    );
  }

  const data = (await response.json()) as TokenListResponse;
  const normalized = tokenAddress.toLowerCase();

  const match = data.tokens.find(t => t.address.toLowerCase() === normalized);
  if (!match) {
    throw new BadRequestError(`Token ${tokenAddress} is not listed for ${network}`);
  }

  return {
    address: match.address.toLowerCase() as Address,
    symbol: match.symbol,
    decimals: match.decimals,
    logoURI: match.logoURI,
  };
}
