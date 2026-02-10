import { createPublicClient, http, type Address, type Hash } from 'viem';
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

export { Actions };
