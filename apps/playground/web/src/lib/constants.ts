import type { Address } from 'viem';

/**
 * Tempo Testnet Configuration
 */
export const TEMPO_TESTNET = {
  id: 42429,
  name: 'Tempo Testnet',
  network: 'tempo-testnet',
  nativeCurrency: {
    name: 'USD',
    symbol: 'USD',
    decimals: 6,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.tempo.xyz'],
      webSocket: ['wss://rpc.testnet.tempo.xyz'],
    },
    public: {
      http: ['https://rpc.testnet.tempo.xyz'],
      webSocket: ['wss://rpc.testnet.tempo.xyz'],
    },
  },
  blockExplorers: {
    default: { name: 'Tempo Explorer', url: 'https://explore.tempo.xyz' },
  },
} as const;

/**
 * Default fee token address (AlphaUSD)
 */
export const DEFAULT_FEE_TOKEN_ADDRESS = '0x20c0000000000000000000000000000000000001' as Address;

/**
 * External links
 */
export const LINKS = {
  faucet: 'https://docs.tempo.xyz/quickstart/faucet',
  explorer: 'https://explore.tempo.xyz',
  docs: 'https://docs.tempo.xyz',
  gateway: 'https://gateway.temporium.xyz',
  github: 'https://github.com/tempoxyz',
} as const;

/**
 * Timing constants (in milliseconds)
 */
export const TIMING = {
  COPY_FEEDBACK_MS: 2000,
  DEBOUNCE_MS: 500,
  COMPILE_DEBOUNCE_MS: 1000,
} as const;

/**
 * Solidity compiler settings
 */
export const SOLC_SETTINGS = {
  version: '0.8.28',
  optimizer: {
    enabled: true,
    runs: 200,
  },
} as const;

/**
 * OpenZeppelin contracts CDN URL
 */
export const OPENZEPPELIN_CDN = 'https://unpkg.com/@openzeppelin/contracts@5.0.0';

/**
 * Default Solidity contract template
 */
export const DEFAULT_CONTRACT = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract HelloWorld {
    string public message;

    constructor(string memory _message) {
        message = _message;
    }

    function setMessage(string memory _message) public {
        message = _message;
    }
}
`;
