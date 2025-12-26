#!/usr/bin/env node
/**
 * Patches the ox library in tempo.ts to add transports to allowCredentials
 * This fixes 1Password not being triggered during WebAuthn signing
 */

const fs = require('fs');
const path = require('path');

const files = [
  'node_modules/tempo.ts/node_modules/ox/_esm/core/WebAuthnP256.js',
  'node_modules/tempo.ts/node_modules/ox/_cjs/core/WebAuthnP256.js',
];

const search = `                            type: 'public-key',
                        }))`;

const replace = `                            type: 'public-key',
                            transports: ['internal', 'hybrid'],
                        }))`;

const search2 = `                                type: 'public-key',
                            },
                        ],`;

const replace2 = `                                type: 'public-key',
                                transports: ['internal', 'hybrid'],
                            },
                        ],`;

let patched = 0;

for (const file of files) {
  const filePath = path.resolve(process.cwd(), file);

  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${file} (not found)`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  if (content.includes("transports: ['internal', 'hybrid']")) {
    console.log(`Skipping ${file} (already patched)`);
    continue;
  }

  content = content.replace(search, replace);
  content = content.replace(search2, replace2);

  fs.writeFileSync(filePath, content);
  console.log(`Patched ${file}`);
  patched++;
}

console.log(`\nPatched ${patched} files`);
