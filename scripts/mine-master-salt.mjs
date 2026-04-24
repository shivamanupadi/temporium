#!/usr/bin/env node
/**
 * Locally grind a TIP-1022 master salt for a given wallet address.
 *
 * Usage:
 *   node scripts/mine-master-salt.mjs 0xYourWalletAddress
 *
 * The browser path uses Cloudflare Containers (standard-4, 4 vCPU) which
 * takes 1-3 minutes. This script uses your local CPU + worker_threads, which
 * is meaningfully faster on most dev machines (~30s on an M2 Pro, faster on
 * a 16-32 core x86 box).
 *
 * Once mined, head to /portal/virtual-addresses, click "Link existing", and
 * paste the printed `masterId`. The server will verify on-chain and the row
 * will be linked to your wallet — no on-chain registration tx needed if your
 * address is already registered. If it's NOT yet registered, you can submit
 * `registerVirtualMaster(salt)` from any tool with the printed `salt`.
 *
 * Requires Node 22+ (uses built-in `navigator.hardwareConcurrency` so ox can
 * spawn its worker pool). The repo's existing `ox` install is reused.
 */

import { VirtualMaster } from 'ox/tempo';

const address = process.argv[2];

if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
  console.error('Usage: node scripts/mine-master-salt.mjs 0xYourWalletAddress');
  process.exit(1);
}

const cores =
  typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 'unknown';
console.log(`Mining TIP-1022 salt for ${address} on ${cores} cores...`);
console.log('Press Ctrl-C to abort.\n');

const startedAt = Date.now();
let lastReport = startedAt;

const result = await VirtualMaster.mineSaltAsync({
  address,
  onProgress: ({ attempts, rate, workers }) => {
    const now = Date.now();
    if (now - lastReport > 1500) {
      const a = (Number(attempts) / 1_000_000).toFixed(1);
      const r = (Number(rate) / 1_000_000).toFixed(1);
      const elapsed = ((now - startedAt) / 1000).toFixed(1);
      process.stdout.write(
        `  ${a}M hashes · ${r}M/s · ${workers} workers · ${elapsed}s elapsed\r`
      );
      lastReport = now;
    }
  },
});

if (!result) {
  console.error('\nNo valid salt found within the search range. Try again.');
  process.exit(1);
}

const masterId = VirtualMaster.getMasterId({ address, salt: result.salt });
const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

console.log(`\n\nFound in ${elapsedSec}s\n`);
console.log(`  address:  ${address}`);
console.log(`  masterId: ${masterId}`);
console.log(`  salt:     ${result.salt}\n`);

console.log('Next steps:');
console.log('  1. Open /portal/virtual-addresses');
console.log(`  2. Click "Link existing" and paste: ${masterId}`);
console.log(
  '  3. If your address is not yet on-chain, submit registerVirtualMaster(salt) first.'
);
