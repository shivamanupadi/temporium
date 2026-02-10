import { createPublicClient, http, type Address, type Hash } from 'viem';
import { Actions } from 'viem/tempo';
import { tempoBaseChain, DEFAULT_FEE_TOKEN_ADDRESS } from './constants';

/**
 * Create tempo chain with fee token
 */
export const tempoChain = tempoBaseChain.extend({ feeToken: DEFAULT_FEE_TOKEN_ADDRESS });

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
 * Fund account from faucet (testnet only)
 */
export async function fundFromFaucet(account: Address): Promise<readonly Hash[]> {
  const hashes = await Actions.faucet.fund(tempoPublicClient, { account });
  return hashes;
}

// Re-export Actions for use in hooks
export { Actions };
