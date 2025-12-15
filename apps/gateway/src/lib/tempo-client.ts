import { createPublicClient, http, type Address, type Hash } from 'viem';
import { tempoTestnet } from 'tempo.ts/chains';
import { Actions } from 'tempo.ts/viem';
import { DEFAULT_FEE_TOKEN_ADDRESS } from './constants';

/**
 * Create tempo chain with fee token
 */
export const tempoChain = tempoTestnet({ feeToken: DEFAULT_FEE_TOKEN_ADDRESS });

/**
 * Public client for reading from Tempo chain
 */
export const tempoPublicClient = createPublicClient({
  chain: tempoChain,
  transport: http(tempoChain.rpcUrls.default.http[0]),
});

/**
 * Get token balance for an account using tempo.ts SDK
 */
export async function getTokenBalance(
  tokenAddress: Address,
  accountAddress: Address
): Promise<bigint> {
  try {
    const balance = await Actions.token.getBalance(tempoPublicClient, {
      token: tokenAddress,
      account: accountAddress,
    });
    return balance;
  } catch (error) {
    console.error('Failed to get token balance:', error);
    return 0n;
  }
}

/**
 * Convert a string memo to bytes32 (padded)
 */
export function stringToBytes32(str: string): `0x${string}` {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  const truncated = bytes.slice(0, 32);
  const padded = new Uint8Array(32);
  padded.set(truncated);

  return `0x${Array.from(padded)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')}` as `0x${string}`;
}

/**
 * Get explorer URL for a transaction
 */
export function getExplorerTxUrl(txHash: string): string {
  return `${tempoChain.blockExplorers?.default.url}/tx/${txHash}`;
}

/**
 * Get explorer URL for an address
 */
export function getExplorerAddressUrl(address: string): string {
  return `${tempoChain.blockExplorers?.default.url}/address/${address}`;
}

/**
 * Get explorer URL for a token
 */
export function getExplorerTokenUrl(address: string): string {
  return `${tempoChain.blockExplorers?.default.url}/token/${address}`;
}

/**
 * Fund account from faucet (testnet only)
 */
export async function fundFromFaucet(account: Address): Promise<readonly Hash[]> {
  const hashes = await Actions.faucet.fund(tempoPublicClient, { account });
  return hashes;
}

/**
 * Get swap quote for exact input amount
 */
export async function getSwapQuote(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint
): Promise<bigint> {
  try {
    const amountOut = await Actions.dex.getSellQuote(tempoPublicClient, {
      tokenIn,
      tokenOut,
      amountIn,
    });
    return amountOut;
  } catch (error) {
    console.error('Failed to get swap quote:', error);
    return 0n;
  }
}

/**
 * Pool info type
 */
export interface PoolInfo {
  reserveUserToken: bigint;
  reserveValidatorToken: bigint;
  totalSupply: bigint;
}

/**
 * Get AMM pool info for a token pair
 */
export async function getPoolInfo(
  userToken: Address,
  validatorToken: Address
): Promise<PoolInfo | null> {
  try {
    const pool = await Actions.amm.getPool(tempoPublicClient, {
      userToken,
      validatorToken,
    });
    return pool;
  } catch (error) {
    console.error('Failed to get pool info:', error);
    return null;
  }
}

/**
 * Get user's LP token balance for a pool
 */
export async function getLiquidityBalance(
  userToken: Address,
  validatorToken: Address,
  account: Address
): Promise<bigint> {
  try {
    const balance = await Actions.amm.getLiquidityBalance(tempoPublicClient, {
      userToken,
      validatorToken,
      address: account,
    });
    return balance;
  } catch (error) {
    console.error('Failed to get liquidity balance:', error);
    return 0n;
  }
}

// Re-export Actions for use in hooks
export { Actions };
