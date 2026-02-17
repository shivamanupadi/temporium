import { createPublicClient, http, type Address, type Hash, type TransactionReceipt } from 'viem';
import { tempoBaseChain, DEFAULT_FEE_TOKEN_ADDRESS } from './constants';

export const tempoChain = tempoBaseChain.extend({ feeToken: DEFAULT_FEE_TOKEN_ADDRESS });

export const tempoPublicClient = createPublicClient({
  chain: tempoChain,
  transport: http(tempoChain.rpcUrls.default.http[0]),
});

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
