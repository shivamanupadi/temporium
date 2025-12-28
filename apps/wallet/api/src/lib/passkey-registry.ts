/**
 * PasskeyRegistry Contract ABI
 * 1 passkey = 1 wallet (derived from public key)
 */
export const PasskeyRegistryABI = [
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'passkeys',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [
      { name: 'publicKey', type: 'bytes' },
      { name: 'wallet', type: 'address' },
      { name: 'createdAt', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'register',
    inputs: [
      { name: 'credentialIdHash', type: 'bytes32' },
      { name: 'publicKey', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getPublicKey',
    inputs: [{ name: 'credentialIdHash', type: 'bytes32' }],
    outputs: [
      { name: 'publicKey', type: 'bytes' },
      { name: 'wallet', type: 'address' },
      { name: 'createdAt', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isRegistered',
    inputs: [{ name: 'credentialIdHash', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'PasskeyRegistered',
    inputs: [
      { name: 'credentialIdHash', type: 'bytes32', indexed: true },
      { name: 'wallet', type: 'address', indexed: true },
      { name: 'publicKey', type: 'bytes', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;
