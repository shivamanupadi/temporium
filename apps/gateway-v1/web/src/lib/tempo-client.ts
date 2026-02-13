import { createPublicClient, http, type Address, type Hash, type TransactionReceipt } from 'viem';
import { Actions } from 'viem/tempo';
import { tempoBaseChain, DEFAULT_FEE_TOKEN_ADDRESS } from './constants';

export const tempoChain = tempoBaseChain.extend({ feeToken: DEFAULT_FEE_TOKEN_ADDRESS });

export const tempoPublicClient = createPublicClient({
  chain: tempoChain,
  transport: http(tempoChain.rpcUrls.default.http[0]),
});

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
 * Wait for a transaction receipt and throw if it reverted.
 */
export async function waitForTx(hash: Hash): Promise<TransactionReceipt> {
  const receipt = await tempoPublicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === 'reverted') {
    throw new Error('Transaction reverted on-chain');
  }
  return receipt;
}

export function getExplorerTxUrl(txHash: string): string {
  return `${tempoChain.blockExplorers?.default.url}/tx/${txHash}`;
}

export function getExplorerAddressUrl(address: string): string {
  return `${tempoChain.blockExplorers?.default.url}/address/${address}`;
}

export function getExplorerTokenUrl(address: string): string {
  return `${tempoChain.blockExplorers?.default.url}/token/${address}`;
}

export async function fundFromFaucet(account: Address): Promise<readonly Hash[]> {
  const hashes = await Actions.faucet.fund(tempoPublicClient, { account });
  return hashes;
}

export async function getSwapQuote(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint
): Promise<bigint> {
  const amountOut = await Actions.dex.getSellQuote(tempoPublicClient, {
    tokenIn,
    tokenOut,
    amountIn,
  });
  return amountOut;
}

export interface PoolInfo {
  reserveUserToken: bigint;
  reserveValidatorToken: bigint;
  totalSupply: bigint;
}

export async function getPoolInfo(
  userToken: Address,
  validatorToken: Address
): Promise<PoolInfo | null> {
  try {
    const pool = await Actions.amm.getPool(tempoPublicClient, {
      userToken,
      validatorToken,
    });
    // Solidity returns zero-initialized structs for non-existent pools
    if (
      pool.totalSupply === 0n &&
      pool.reserveUserToken === 0n &&
      pool.reserveValidatorToken === 0n
    ) {
      return null;
    }
    return pool;
  } catch (error) {
    console.error('Failed to get pool info:', error);
    return null;
  }
}

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

/**
 * Estimate the validatorToken cost for a given userToken amountOut using
 * pool reserves and constant-product formula.  This is an approximation —
 * the contract may apply its own fee.
 */
export function estimateAmmCost(pool: PoolInfo, amountOut: bigint): bigint | null {
  if (amountOut <= 0n || amountOut >= pool.reserveUserToken) return null;
  // constant product: dx = (Rv * dy) / (Ru - dy)
  return (pool.reserveValidatorToken * amountOut) / (pool.reserveUserToken - amountOut);
}

export async function getDexBalance(token: Address, account: Address): Promise<bigint> {
  try {
    const balance = await Actions.dex.getBalance(tempoPublicClient, {
      token,
      account,
    });
    return balance;
  } catch (error) {
    console.error('Failed to get DEX balance:', error);
    return 0n;
  }
}

// ---------------------------------------------------------------------------
// Tick / Price helpers for the stablecoin DEX orderbook
// ---------------------------------------------------------------------------

export const TICK_SPACING = 10;
export const MIN_TICK = -2000;
export const MAX_TICK = 2000;
export const PRICE_SCALE = 100_000;

/** Convert a tick integer to a human-readable price string (5 decimals). */
export function tickToPrice(tick: number): string {
  return ((PRICE_SCALE + tick) / PRICE_SCALE).toFixed(5);
}

/**
 * Parse a price string and return the nearest valid tick.
 * Returns `null` when the result is out of range or the input is invalid.
 */
export function priceToTick(priceStr: string): number | null {
  const price = parseFloat(priceStr);
  if (isNaN(price) || price <= 0) return null;
  const rawTick = Math.round(price * PRICE_SCALE - PRICE_SCALE);
  const aligned = Math.round(rawTick / TICK_SPACING) * TICK_SPACING;
  if (aligned < MIN_TICK || aligned > MAX_TICK) return null;
  return aligned;
}

// ---------------------------------------------------------------------------
// Orderbook helpers
// ---------------------------------------------------------------------------

export interface OrderbookInfo {
  bestBidTick: number;
  bestAskTick: number;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export async function getOrderbookInfo(
  base: Address,
  quote: Address
): Promise<OrderbookInfo | null> {
  try {
    const book = await Actions.dex.getOrderbook(tempoPublicClient, { base, quote });
    // The `books` mapping returns zero-initialised structs for non-existent pairs
    if (book.base === ZERO_ADDRESS || book.quote === ZERO_ADDRESS) {
      return null;
    }
    return {
      bestBidTick: book.bestBidTick,
      bestAskTick: book.bestAskTick,
    };
  } catch {
    return null;
  }
}

export { Actions };
