import { createPublicClient, http, keccak256, toBytes } from 'viem';
import { tempoTestnet } from 'tempo.ts/chains';
import { PasskeyRegistryABI } from '../src/keys/passkey-registry.abi';

const tempoChain = tempoTestnet({});
const publicClient = createPublicClient({
  chain: tempoChain,
  transport: http(tempoChain.rpcUrls.default.http[0]),
});

async function main() {
  const contractAddress = '0x1ba4046ed9cc653605e18ceb39f6750ff5e8078d' as const;
  const credentialId = 'bKQvWtCMM07dglSVCemBVM-AF6ryozqcM6tyoIHvxf-NKUox8fQ';
  const credentialIdHash = keccak256(toBytes(credentialId));

  console.log('Contract:', contractAddress);
  console.log('CredentialId:', credentialId);
  console.log('CredentialIdHash:', credentialIdHash);

  // Check if contract exists
  const code = await publicClient.getCode({ address: contractAddress });
  console.log('\nContract code exists:', code && code !== '0x');

  // Try to read owner
  try {
    const owner = await publicClient.readContract({
      address: contractAddress,
      abi: PasskeyRegistryABI,
      functionName: 'owner',
      args: [],
    });
    console.log('Contract owner:', owner);
  } catch (e: any) {
    console.log('Failed to read owner:', e.message);
  }

  // Check relayer authorization
  const relayerAddress = '0xb817Bf4350FFCa85a9c44A30F7F169AcBB3f9B2B';
  try {
    const isRelayer = await publicClient.readContract({
      address: contractAddress,
      abi: PasskeyRegistryABI,
      functionName: 'authorizedRelayers',
      args: [relayerAddress],
    });
    console.log('Relayer authorized:', isRelayer);
  } catch (e: any) {
    console.log('Failed to check relayer:', e.message);
  }

  // Try to check if registered
  try {
    const isRegistered = await publicClient.readContract({
      address: contractAddress,
      abi: PasskeyRegistryABI,
      functionName: 'isRegistered',
      args: [credentialIdHash],
    });
    console.log('\nisRegistered:', isRegistered);
  } catch (e: any) {
    console.log('Failed to check isRegistered:', e.message);
  }

  // Try getPublicKey
  try {
    const result = await publicClient.readContract({
      address: contractAddress,
      abi: PasskeyRegistryABI,
      functionName: 'getPublicKey',
      args: [credentialIdHash],
    });
    console.log('getPublicKey result:', result);
  } catch (e: any) {
    console.log('Failed getPublicKey:', e.message);
  }

  // Check the transaction
  const txHash =
    '0x09ac705ec288049ee5f9acc11a8f0d5ed527713e15d50fdc67a195262524b3e1';
  try {
    const receipt = await publicClient.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });
    console.log('\nTx status:', receipt.status);
    console.log('Tx logs count:', receipt.logs.length);
    if (receipt.logs.length > 0) {
      console.log('First log:', receipt.logs[0]);
    }
  } catch (e: any) {
    console.log('Failed to get tx receipt:', e.message);
  }
}

main().catch(console.error);
