/**
 * Test script: AMM rebalance swap end-to-end verification
 *
 * 1. Create a secp256k1 wallet
 * 2. Fund from faucet
 * 3. Get pool info
 * 4. Compute expected amounts using our client-side math
 * 5. Execute the swap
 * 6. Decode the on-chain RebalanceSwap event
 * 7. Compare our math vs on-chain reality
 */

import { createPublicClient, createClient, http, parseEventLogs, type Address, type Hash } from 'viem';
import { tempoModerato } from 'viem/chains';
import { Account, Actions, Abis } from 'viem/tempo';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const FEE_TOKEN: Address = '0x20c0000000000000000000000000000000000001'; // AlphaUSD
const chain = tempoModerato.extend({ feeToken: FEE_TOKEN });
const rpcUrl = chain.rpcUrls.default.http[0];

// Fee AMM constants (from docs)
const AMM_N = 9985n;
const AMM_SCALE = 10000n;

// ---------------------------------------------------------------------------
// Helpers (mirrors tempo-client.ts)
// ---------------------------------------------------------------------------

interface PoolInfo {
  reserveUserToken: bigint;
  reserveValidatorToken: bigint;
  totalSupply: bigint;
}

function getAmmCost(pool: PoolInfo, amountOut: bigint): bigint | null {
  if (amountOut <= 0n || amountOut > pool.reserveUserToken) return null;
  // amountIn = (amountOut * N) / SCALE + 1
  return (amountOut * AMM_N) / AMM_SCALE + 1n;
}

function getAmmOutput(pool: PoolInfo, amountIn: bigint): bigint | null {
  if (amountIn <= 0n) return null;
  // amountOut = ((amountIn - 1) * SCALE) / N
  const raw = amountIn > 1n ? ((amountIn - 1n) * AMM_SCALE) / AMM_N : 0n;
  if (raw <= 0n) return null;
  const clamped = raw > pool.reserveUserToken ? pool.reserveUserToken : raw;
  return clamped <= 0n ? null : clamped;
}

function fmt(val: bigint, decimals: number): string {
  const s = val.toString().padStart(decimals + 1, '0');
  const intPart = s.slice(0, s.length - decimals) || '0';
  const fracPart = s.slice(s.length - decimals);
  return `${intPart}.${fracPart}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== AMM Swap Verification Script ===\n');

  // 1. Generate a fresh wallet
  const privateKey = `0x${[...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')}` as `0x${string}`;
  const account = Account.fromSecp256k1(privateKey);
  console.log('Wallet address:', account.address);

  // 2. Create clients
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  const walletClient = createClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  // 3. Fund from faucet
  console.log('\nFunding from faucet...');
  const fundHashes = await Actions.faucet.fund(publicClient, { account: account.address });
  console.log('Faucet tx hashes:', fundHashes);

  for (const hash of fundHashes) {
    await publicClient.waitForTransactionReceipt({ hash });
  }
  console.log('Faucet funding confirmed.');

  // 4. Fetch token list to get token info
  const tokenListRes = await fetch('https://tokenlist.tempo.xyz/list/' + chain.id, {
    headers: { 'X-Tempo-Network': 'testnet' },
  });
  const tokenList = await tokenListRes.json() as { tokens: Array<{ address: Address; symbol: string; decimals: number }> };
  const tokens = tokenList.tokens;
  console.log('\nAvailable tokens:', tokens.map(t => `${t.symbol} (${t.address})`).join(', '));

  // 5. Check balances
  console.log('\n--- Balances ---');
  for (const token of tokens) {
    const balance = await Actions.token.getBalance(publicClient, {
      token: token.address,
      account: account.address,
    });
    console.log(`  ${token.symbol}: ${fmt(balance, token.decimals)}`);
  }

  // 6. Pick two tokens and get pool info
  // Try all pairs to find one with reserves
  let userToken: typeof tokens[0] | null = null;
  let validatorToken: typeof tokens[0] | null = null;
  let pool: PoolInfo | null = null;

  for (let i = 0; i < tokens.length; i++) {
    for (let j = 0; j < tokens.length; j++) {
      if (i === j) continue;
      try {
        const p = await Actions.amm.getPool(publicClient, {
          userToken: tokens[i].address,
          validatorToken: tokens[j].address,
        });
        if (p.totalSupply > 0n && p.reserveUserToken > 0n) {
          userToken = tokens[i];
          validatorToken = tokens[j];
          pool = p;
          break;
        }
      } catch {}
    }
    if (pool) break;
  }

  if (!pool || !userToken || !validatorToken) {
    console.error('\nNo pool with reserves found. Cannot test swap.');
    process.exit(1);
  }

  console.log(`\n--- Pool: ${userToken.symbol} / ${validatorToken.symbol} ---`);
  console.log(`  reserveUserToken:      ${fmt(pool.reserveUserToken, userToken.decimals)} ${userToken.symbol}`);
  console.log(`  reserveValidatorToken: ${fmt(pool.reserveValidatorToken, validatorToken.decimals)} ${validatorToken.symbol}`);
  console.log(`  totalSupply:           ${pool.totalSupply}`);

  // 7. Compute expected swap amounts
  const swapInputRaw = 100n * 10n ** BigInt(validatorToken.decimals); // 100 validator tokens
  const expectedOutput = getAmmOutput(pool, swapInputRaw);
  const expectedCost = expectedOutput ? getAmmCost(pool, expectedOutput) : null;

  console.log(`\n--- Our Client-Side Math ---`);
  console.log(`  Input (typed by user):  ${fmt(swapInputRaw, validatorToken.decimals)} ${validatorToken.symbol}`);
  console.log(`  getAmmOutput(input):    ${expectedOutput ? fmt(expectedOutput, userToken.decimals) : 'null'} ${userToken.symbol}`);
  console.log(`  getAmmCost(output):     ${expectedCost ? fmt(expectedCost, validatorToken.decimals) : 'null'} ${validatorToken.symbol}`);

  if (!expectedOutput) {
    console.error('getAmmOutput returned null. Cannot proceed.');
    process.exit(1);
  }

  // 8. Check validator token balance
  const validatorBalance = await Actions.token.getBalance(publicClient, {
    token: validatorToken.address,
    account: account.address,
  });
  console.log(`\n  Validator token balance: ${fmt(validatorBalance, validatorToken.decimals)} ${validatorToken.symbol}`);

  if (validatorBalance < (expectedCost ?? 0n)) {
    console.error('  Insufficient balance for swap. Trying smaller amount...');
    // Try with 10 tokens instead
  }

  // 9. Execute the swap
  console.log(`\n--- Executing Swap ---`);
  console.log(`  amountOut param sent to contract: ${fmt(expectedOutput, userToken.decimals)} ${userToken.symbol}`);

  const txHash = await Actions.amm.rebalanceSwap(walletClient, {
    userToken: userToken.address,
    validatorToken: validatorToken.address,
    amountOut: expectedOutput,
    to: account.address,
  });
  console.log(`  TX hash: ${txHash}`);

  // 10. Wait for receipt
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log(`  Status: ${receipt.status}`);
  console.log(`  Gas used: ${receipt.gasUsed}`);
  console.log(`  Effective gas price: ${receipt.effectiveGasPrice}`);
  console.log(`  Gas cost (raw): ${receipt.gasUsed * receipt.effectiveGasPrice}`);

  // 11. Decode RebalanceSwap event
  const [swapEvent] = parseEventLogs({
    abi: Abis.feeAmm,
    logs: receipt.logs,
    eventName: 'RebalanceSwap',
    strict: true,
  });

  if (!swapEvent) {
    console.error('  No RebalanceSwap event found in logs!');
    process.exit(1);
  }

  const onChainAmountIn = swapEvent.args.amountIn;
  const onChainAmountOut = swapEvent.args.amountOut;

  console.log(`\n--- On-Chain Event Data ---`);
  console.log(`  amountIn (charged):  ${fmt(onChainAmountIn, validatorToken.decimals)} ${validatorToken.symbol}`);
  console.log(`  amountOut (received): ${fmt(onChainAmountOut, userToken.decimals)} ${userToken.symbol}`);

  // 12. Compare
  console.log(`\n--- Comparison ---`);
  console.log(`  amountOut: UI sent ${fmt(expectedOutput, userToken.decimals)}, chain gave ${fmt(onChainAmountOut, userToken.decimals)} — ${expectedOutput === onChainAmountOut ? 'MATCH ✓' : 'MISMATCH ✗'}`);
  console.log(`  amountIn:  UI expected ${expectedCost ? fmt(expectedCost, validatorToken.decimals) : 'null'}, chain charged ${fmt(onChainAmountIn, validatorToken.decimals)} — ${expectedCost === onChainAmountIn ? 'MATCH ✓' : 'MISMATCH ✗'}`);

  // 13. Verify the formula
  // On-chain: amountIn = (amountOut * SCALE) / N + 1
  const formulaAmountIn = (onChainAmountOut * AMM_SCALE) / AMM_N + 1n;
  console.log(`\n--- Formula Verification ---`);
  console.log(`  Formula: (${onChainAmountOut} * ${AMM_SCALE}) / ${AMM_N} + 1 = ${formulaAmountIn}`);
  console.log(`  On-chain amountIn: ${onChainAmountIn}`);
  console.log(`  Formula matches chain: ${formulaAmountIn === onChainAmountIn ? 'YES ✓' : 'NO ✗'}`);

  // 14. Gas fee analysis
  const gasCostRaw = receipt.gasUsed * receipt.effectiveGasPrice;
  console.log(`\n--- Gas Fee Analysis ---`);
  console.log(`  gasUsed: ${receipt.gasUsed}`);
  console.log(`  effectiveGasPrice: ${receipt.effectiveGasPrice}`);
  console.log(`  gasUsed * effectiveGasPrice = ${gasCostRaw}`);
  console.log(`  As fee token (6 decimals): ${fmt(gasCostRaw, 6)}`);
  console.log(`  As fee token (18 decimals): ${fmt(gasCostRaw, 18)}`);

  // 15. Check balances after swap
  console.log('\n--- Balances After Swap ---');
  for (const token of tokens) {
    const balance = await Actions.token.getBalance(publicClient, {
      token: token.address,
      account: account.address,
    });
    console.log(`  ${token.symbol}: ${fmt(balance, token.decimals)}`);
  }

  // 16. Also dump all Transfer events from the receipt to see every token movement
  console.log('\n--- All Token Transfer Events ---');
  try {
    const transferEvents = parseEventLogs({
      abi: [{
        type: 'event',
        name: 'Transfer',
        inputs: [
          { name: 'from', type: 'address', indexed: true },
          { name: 'to', type: 'address', indexed: true },
          { name: 'value', type: 'uint256', indexed: false },
        ],
      }],
      logs: receipt.logs,
      eventName: 'Transfer',
    });
    for (const evt of transferEvents) {
      const token = tokens.find(t => t.address.toLowerCase() === evt.address.toLowerCase());
      const symbol = token ? token.symbol : evt.address;
      const decimals = token ? token.decimals : 6;
      console.log(`  ${symbol}: ${evt.args.from?.slice(0, 10)}... → ${evt.args.to?.slice(0, 10)}... amount=${fmt(evt.args.value ?? 0n, decimals)}`);
    }
  } catch (e) {
    console.log('  (Could not parse Transfer events)');
  }

  // =========================================================================
  // PART 2: LIQUIDITY (Mint + Burn) VERIFICATION
  // =========================================================================

  console.log('\n\n========================================');
  console.log('=== AMM Liquidity Verification ===');
  console.log('========================================\n');

  // Re-fetch pool after swap
  const poolBefore = await Actions.amm.getPool(publicClient, {
    userToken: userToken!.address,
    validatorToken: validatorToken!.address,
  });
  const lpBefore = await Actions.amm.getLiquidityBalance(publicClient, {
    userToken: userToken!.address,
    validatorToken: validatorToken!.address,
    address: account.address,
  });

  console.log('--- Pool Before Mint ---');
  console.log(`  reserveUserToken:      ${fmt(poolBefore.reserveUserToken, userToken!.decimals)} ${userToken!.symbol}`);
  console.log(`  reserveValidatorToken: ${fmt(poolBefore.reserveValidatorToken, validatorToken!.decimals)} ${validatorToken!.symbol}`);
  console.log(`  totalSupply:           ${poolBefore.totalSupply}`);
  console.log(`  Our LP balance:        ${lpBefore}`);

  // --- MINT (Add Liquidity) ---
  const mintAmount = 50n * 10n ** BigInt(validatorToken!.decimals); // 50 validator tokens
  console.log(`\n--- Minting Liquidity ---`);
  console.log(`  Depositing: ${fmt(mintAmount, validatorToken!.decimals)} ${validatorToken!.symbol}`);

  const mintHash = await Actions.amm.mint(walletClient, {
    userTokenAddress: userToken!.address,
    validatorTokenAddress: validatorToken!.address,
    validatorTokenAmount: mintAmount,
    to: account.address,
  });
  console.log(`  TX hash: ${mintHash}`);

  const mintReceipt = await publicClient.waitForTransactionReceipt({ hash: mintHash });
  console.log(`  Status: ${mintReceipt.status}`);

  // Decode Mint event
  const [mintEvent] = parseEventLogs({
    abi: Abis.feeAmm,
    logs: mintReceipt.logs,
    eventName: 'Mint',
    strict: true,
  });

  if (mintEvent) {
    console.log(`\n--- Mint Event ---`);
    console.log(`  sender:               ${mintEvent.args.sender}`);
    console.log(`  to:                   ${mintEvent.args.to}`);
    console.log(`  userToken:            ${mintEvent.args.userToken}`);
    console.log(`  validatorToken:       ${mintEvent.args.validatorToken}`);
    console.log(`  amountValidatorToken: ${fmt(mintEvent.args.amountValidatorToken, validatorToken!.decimals)} ${validatorToken!.symbol}`);
    console.log(`  liquidity (LP minted):${mintEvent.args.liquidity}`);
  } else {
    console.log('  No Mint event found!');
  }

  // Pool after mint
  const poolAfterMint = await Actions.amm.getPool(publicClient, {
    userToken: userToken!.address,
    validatorToken: validatorToken!.address,
  });
  const lpAfterMint = await Actions.amm.getLiquidityBalance(publicClient, {
    userToken: userToken!.address,
    validatorToken: validatorToken!.address,
    address: account.address,
  });

  console.log(`\n--- Pool After Mint ---`);
  console.log(`  reserveUserToken:      ${fmt(poolAfterMint.reserveUserToken, userToken!.decimals)} ${userToken!.symbol}`);
  console.log(`  reserveValidatorToken: ${fmt(poolAfterMint.reserveValidatorToken, validatorToken!.decimals)} ${validatorToken!.symbol}`);
  console.log(`  totalSupply:           ${poolAfterMint.totalSupply}`);
  console.log(`  Our LP balance:        ${lpAfterMint}`);
  console.log(`  LP gained:             ${lpAfterMint - lpBefore}`);

  // Verify validator reserve increased by exactly mintAmount
  const reserveDiff = poolAfterMint.reserveValidatorToken - poolBefore.reserveValidatorToken;
  console.log(`\n  Validator reserve change: ${fmt(reserveDiff, validatorToken!.decimals)} ${validatorToken!.symbol}`);
  console.log(`  Expected:                ${fmt(mintAmount, validatorToken!.decimals)} ${validatorToken!.symbol}`);
  console.log(`  Match: ${reserveDiff === mintAmount ? 'YES ✓' : 'NO ✗'}`);

  // User token reserve should be unchanged (single-sided mint)
  const userReserveDiff = poolAfterMint.reserveUserToken - poolBefore.reserveUserToken;
  console.log(`  User reserve change:     ${fmt(userReserveDiff, userToken!.decimals)} ${userToken!.symbol} (should be 0)`);
  console.log(`  Single-sided: ${userReserveDiff === 0n ? 'YES ✓' : 'NO ✗'}`);

  // --- BURN (Remove Liquidity) ---
  if (lpAfterMint > 0n) {
    // Burn half of our LP tokens
    const burnAmount = lpAfterMint / 2n;
    console.log(`\n--- Burning Liquidity ---`);
    console.log(`  Burning LP: ${burnAmount}`);

    // Estimated pro-rata receive (as shown in UI)
    const estUserOut = (burnAmount * poolAfterMint.reserveUserToken) / poolAfterMint.totalSupply;
    const estValidatorOut = (burnAmount * poolAfterMint.reserveValidatorToken) / poolAfterMint.totalSupply;
    console.log(`  UI estimated receive:`);
    console.log(`    ${fmt(estUserOut, userToken!.decimals)} ${userToken!.symbol}`);
    console.log(`    ${fmt(estValidatorOut, validatorToken!.decimals)} ${validatorToken!.symbol}`);

    const burnHash = await Actions.amm.burn(walletClient, {
      userToken: userToken!.address,
      validatorToken: validatorToken!.address,
      liquidity: burnAmount,
      to: account.address,
    });
    console.log(`  TX hash: ${burnHash}`);

    const burnReceipt = await publicClient.waitForTransactionReceipt({ hash: burnHash });
    console.log(`  Status: ${burnReceipt.status}`);

    // Decode Burn event
    const [burnEvent] = parseEventLogs({
      abi: Abis.feeAmm,
      logs: burnReceipt.logs,
      eventName: 'Burn',
      strict: true,
    });

    if (burnEvent) {
      console.log(`\n--- Burn Event ---`);
      console.log(`  sender:               ${burnEvent.args.sender}`);
      console.log(`  amountUserToken:      ${fmt(burnEvent.args.amountUserToken, userToken!.decimals)} ${userToken!.symbol}`);
      console.log(`  amountValidatorToken: ${fmt(burnEvent.args.amountValidatorToken, validatorToken!.decimals)} ${validatorToken!.symbol}`);
      console.log(`  liquidity (LP burned):${burnEvent.args.liquidity}`);

      console.log(`\n--- Burn Comparison (UI estimate vs on-chain) ---`);
      console.log(`  User token:      UI=${fmt(estUserOut, userToken!.decimals)}, Chain=${fmt(burnEvent.args.amountUserToken, userToken!.decimals)} — ${estUserOut === burnEvent.args.amountUserToken ? 'MATCH ✓' : 'MISMATCH ✗'}`);
      console.log(`  Validator token: UI=${fmt(estValidatorOut, validatorToken!.decimals)}, Chain=${fmt(burnEvent.args.amountValidatorToken, validatorToken!.decimals)} — ${estValidatorOut === burnEvent.args.amountValidatorToken ? 'MATCH ✓' : 'MISMATCH ✗'}`);
    } else {
      console.log('  No Burn event found!');
    }

    // Balances after burn
    console.log('\n--- Balances After Burn ---');
    for (const token of tokens) {
      const balance = await Actions.token.getBalance(publicClient, {
        token: token.address,
        account: account.address,
      });
      console.log(`  ${token.symbol}: ${fmt(balance, token.decimals)}`);
    }
  }

  console.log('\n=== All Tests Done ===');
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
