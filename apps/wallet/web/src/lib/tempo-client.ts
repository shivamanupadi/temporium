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

// ---------------------------------------------------------------------------
// Fee AMM quote helpers (fixed-rate, no RPC needed)
//
// The Fee AMM uses fixed rates - NOT a bonding curve:
//   Fee swap (protocol-only):  amountOut = (amountIn * M) / SCALE
//   Rebalance swap (public):   amountIn  = (amountOut * N) / SCALE + 1
//
// M = 9970, N = 9985, SCALE = 10000
//
// In a rebalance swap the caller pays validator tokens and receives MORE
// user tokens (a ~0.15% bonus incentivising pool rebalancing).
//
// See: https://docs.tempo.xyz/protocol/fees/spec-fee-amm
// ---------------------------------------------------------------------------

const AMM_N = 9985n;
const AMM_SCALE = 10000n;

/**
 * Compute the exact validatorToken cost (amountIn) for a given userToken
 * amountOut using the Fee AMM's fixed rebalance rate.
 * Returns null if amountOut exceeds pool reserves.
 */
export function getAmmCost(pool: PoolInfo, amountOut: bigint): bigint | null {
  if (amountOut <= 0n || amountOut > pool.reserveUserToken) return null;
  // amountIn = (amountOut * N) / SCALE + 1  (rounded up)
  return (amountOut * AMM_N) / AMM_SCALE + 1n;
}

/**
 * Compute the max userToken amountOut for a given validatorToken amountIn
 * using the Fee AMM's fixed rebalance rate.
 * Clamps to available pool reserves.
 */
export function getAmmOutput(pool: PoolInfo, amountIn: bigint): bigint | null {
  if (amountIn <= 0n) return null;
  // amountOut = ((amountIn - 1) * SCALE) / N  (rounded down)
  const raw = amountIn > 1n ? ((amountIn - 1n) * AMM_SCALE) / AMM_N : 0n;
  if (raw <= 0n) return null;
  // Clamp to pool reserves; return null when reserves are exhausted
  const clamped = raw > pool.reserveUserToken ? pool.reserveUserToken : raw;
  return clamped <= 0n ? null : clamped;
}

export { Actions };
