import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { tempoTestnet } from 'tempo.ts/chains';
import { Actions } from 'tempo.ts/viem';
import * as fs from 'fs';
import * as path from 'path';
import solc from 'solc';
import { PasskeyRegistryABI } from '../src/keys/passkey-registry.abi';

const DEFAULT_FEE_TOKEN_ADDRESS =
  '0x20c0000000000000000000000000000000000001' as Address;
const tempoChain = tempoTestnet({ feeToken: DEFAULT_FEE_TOKEN_ADDRESS });

function compileContract(): string {
  const contractPath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    'contracts',
    'PasskeyRegistry.sol',
  );
  const source = fs.readFileSync(contractPath, 'utf8');

  const input = {
    language: 'Solidity',
    sources: {
      'PasskeyRegistry.sol': {
        content: source,
      },
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['*'],
        },
      },
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    const errors = output.errors.filter((e: any) => e.severity === 'error');
    if (errors.length > 0) {
      console.error('Compilation errors:', errors);
      throw new Error('Contract compilation failed');
    }
  }

  const bytecode =
    output.contracts['PasskeyRegistry.sol']['PasskeyRegistry'].evm.bytecode
      .object;
  return '0x' + bytecode;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== PasskeyRegistry Deployment Script ===\n');

  // Create public client
  const publicClient = createPublicClient({
    chain: tempoChain,
    transport: http(tempoChain.rpcUrls.default.http[0]),
  });

  // Step 1: Generate deployer account
  console.log('1. Generating deployer account...');
  const deployerPrivateKey = generatePrivateKey();
  const deployerAccount = privateKeyToAccount(deployerPrivateKey);
  console.log(`   Deployer address: ${deployerAccount.address}`);

  // Step 2: Fund deployer from faucet
  console.log('\n2. Funding deployer from faucet...');
  try {
    const faucetHashes = await Actions.faucet.fund(publicClient, {
      account: deployerAccount.address,
    });
    console.log(`   Faucet transactions: ${faucetHashes.length} tx(s)`);

    // Wait for faucet transactions
    for (const hash of faucetHashes) {
      await publicClient.waitForTransactionReceipt({ hash });
    }
    console.log('   Faucet funding confirmed!');
  } catch (error: any) {
    console.error('   Faucet error:', error.message);
    throw error;
  }

  // Small delay to ensure balance is updated
  await sleep(2000);

  // Check deployer balance
  const deployerBalance = await publicClient.getBalance({
    address: deployerAccount.address,
  });
  console.log(`   Deployer balance: ${Number(deployerBalance) / 1e6} USD`);

  // Step 3: Generate relayer account
  console.log('\n3. Generating relayer account...');
  const relayerPrivateKey = generatePrivateKey();
  const relayerAccount = privateKeyToAccount(relayerPrivateKey);
  console.log(`   Relayer address: ${relayerAccount.address}`);

  // Step 4: Fund relayer from faucet
  console.log('\n4. Funding relayer from faucet...');
  try {
    const faucetHashes = await Actions.faucet.fund(publicClient, {
      account: relayerAccount.address,
    });
    console.log(`   Faucet transactions: ${faucetHashes.length} tx(s)`);

    for (const hash of faucetHashes) {
      await publicClient.waitForTransactionReceipt({ hash });
    }
    console.log('   Faucet funding confirmed!');
  } catch (error: any) {
    console.error('   Faucet error:', error.message);
    throw error;
  }

  await sleep(2000);

  const relayerBalance = await publicClient.getBalance({
    address: relayerAccount.address,
  });
  console.log(`   Relayer balance: ${Number(relayerBalance) / 1e6} USD`);

  // Step 5: Compile contract
  console.log('\n5. Compiling PasskeyRegistry contract...');
  const bytecode = compileContract();
  console.log(`   Bytecode size: ${(bytecode.length - 2) / 2} bytes`);

  // Step 6: Deploy contract
  console.log('\n6. Deploying PasskeyRegistry contract...');
  const deployerWalletClient = createWalletClient({
    account: deployerAccount,
    chain: tempoChain,
    transport: http(tempoChain.rpcUrls.default.http[0]),
  });

  const deployHash = await deployerWalletClient.deployContract({
    abi: PasskeyRegistryABI,
    bytecode: bytecode as `0x${string}`,
    feeToken: DEFAULT_FEE_TOKEN_ADDRESS,
    gas: 3000000n, // Increase gas limit
  } as any);
  console.log(`   Deploy tx: ${deployHash}`);

  const deployReceipt = await publicClient.waitForTransactionReceipt({
    hash: deployHash,
  });

  if (deployReceipt.status === 'reverted') {
    console.error('   DEPLOYMENT REVERTED!');
    console.error('   Gas used:', deployReceipt.gasUsed);
    throw new Error('Contract deployment reverted');
  }

  const contractAddress = deployReceipt.contractAddress!;
  console.log(`   Contract deployed at: ${contractAddress}`);

  // Verify contract code exists
  const code = await publicClient.getCode({ address: contractAddress });
  if (!code || code === '0x') {
    throw new Error('Contract code not found after deployment');
  }
  console.log(`   Contract code verified (${(code.length - 2) / 2} bytes)`);

  // Step 7: Authorize relayer
  console.log('\n7. Authorizing relayer...');
  const setRelayerHash = await deployerWalletClient.writeContract({
    address: contractAddress,
    abi: PasskeyRegistryABI,
    functionName: 'setRelayer',
    args: [relayerAccount.address, true],
    feeToken: DEFAULT_FEE_TOKEN_ADDRESS,
  } as any);
  console.log(`   setRelayer tx: ${setRelayerHash}`);

  await publicClient.waitForTransactionReceipt({ hash: setRelayerHash });
  console.log(`   Relayer ${relayerAccount.address} authorized!`);

  // Step 8: Update .env file
  console.log('\n8. Updating .env file...');
  const envPath = path.join(__dirname, '..', '.env');
  let envContent = '';

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  // Update or add PASSKEY_REGISTRY_ADDRESS
  if (envContent.includes('PASSKEY_REGISTRY_ADDRESS=')) {
    envContent = envContent.replace(
      /PASSKEY_REGISTRY_ADDRESS=.*/,
      `PASSKEY_REGISTRY_ADDRESS="${contractAddress}"`,
    );
  } else {
    envContent += `\nPASSKEY_REGISTRY_ADDRESS="${contractAddress}"`;
  }

  // Update or add RELAYER_PRIVATE_KEY
  if (envContent.includes('RELAYER_PRIVATE_KEY=')) {
    envContent = envContent.replace(
      /RELAYER_PRIVATE_KEY=.*/,
      `RELAYER_PRIVATE_KEY="${relayerPrivateKey}"`,
    );
  } else {
    envContent += `\nRELAYER_PRIVATE_KEY="${relayerPrivateKey}"`;
  }

  // Update or add DEPLOYER_PRIVATE_KEY
  if (envContent.includes('DEPLOYER_PRIVATE_KEY=')) {
    envContent = envContent.replace(
      /DEPLOYER_PRIVATE_KEY=.*/,
      `DEPLOYER_PRIVATE_KEY="${deployerPrivateKey}"`,
    );
  } else {
    envContent += `\nDEPLOYER_PRIVATE_KEY="${deployerPrivateKey}"`;
  }

  fs.writeFileSync(envPath, envContent.trim() + '\n');
  console.log('   .env file updated!');

  // Summary
  console.log('\n=== Deployment Complete ===');
  console.log(`\nContract Address: ${contractAddress}`);
  console.log(`Owner/Deployer:   ${deployerAccount.address}`);
  console.log(`Relayer:          ${relayerAccount.address}`);
  console.log(`\nAll keys saved to .env file`);
  console.log(
    `\nExplorer: https://explorer.testnet.tempo.xyz/address/${contractAddress}`,
  );
}

main().catch((error) => {
  console.error('Deployment failed:', error);
  process.exit(1);
});
