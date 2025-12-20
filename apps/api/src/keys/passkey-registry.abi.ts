/**
 * PasskeyRegistry Contract ABI
 * On-chain registry for WebAuthn/Passkey public keys
 */
export const PasskeyRegistryABI = [
  {
    type: 'function',
    name: 'register',
    inputs: [
      { name: 'credentialIdHash', type: 'bytes32' },
      { name: 'publicKey', type: 'bytes' },
      { name: 'wallet', type: 'address' },
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
      { name: 'isActive', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPasskey',
    inputs: [{ name: 'credentialIdHash', type: 'bytes32' }],
    outputs: [
      { name: 'publicKey', type: 'bytes' },
      { name: 'wallet', type: 'address' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
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
    type: 'function',
    name: 'getWalletPasskeys',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [{ name: '', type: 'bytes32[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'deactivate',
    inputs: [{ name: 'credentialIdHash', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'reactivate',
    inputs: [{ name: 'credentialIdHash', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'passkeys',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [
      { name: 'publicKey', type: 'bytes' },
      { name: 'wallet', type: 'address' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
    ],
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
  {
    type: 'event',
    name: 'PasskeyDeactivated',
    inputs: [
      { name: 'credentialIdHash', type: 'bytes32', indexed: true },
      { name: 'wallet', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'PasskeyReactivated',
    inputs: [
      { name: 'credentialIdHash', type: 'bytes32', indexed: true },
      { name: 'wallet', type: 'address', indexed: true },
    ],
  },
] as const;
