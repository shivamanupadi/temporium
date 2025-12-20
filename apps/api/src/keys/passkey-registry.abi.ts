/**
 * PasskeyRegistry Contract ABI
 * On-chain registry for WebAuthn/Passkey public keys
 */
export const PasskeyRegistryABI = [
  // ============ Constants ============
  {
    type: 'function',
    name: 'MAX_PASSKEYS_PER_WALLET',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },

  // ============ State Variables ============
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'paused',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'authorizedRelayers',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
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
      { name: 'isActive', type: 'bool' },
    ],
    stateMutability: 'view',
  },

  // ============ Owner Functions ============
  {
    type: 'function',
    name: 'transferOwnership',
    inputs: [{ name: 'newOwner', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setRelayer',
    inputs: [
      { name: 'relayer', type: 'address' },
      { name: 'authorized', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'pause',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unpause',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ============ Relayer Functions ============
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

  // ============ View Functions ============
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
    name: 'getWalletPasskeyCount',
    inputs: [{ name: 'wallet', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },

  // ============ Wallet Owner Functions ============
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

  // ============ Events ============
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
  {
    type: 'event',
    name: 'RelayerUpdated',
    inputs: [
      { name: 'relayer', type: 'address', indexed: true },
      { name: 'authorized', type: 'bool', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'OwnershipTransferred',
    inputs: [
      { name: 'previousOwner', type: 'address', indexed: true },
      { name: 'newOwner', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'Paused',
    inputs: [{ name: 'account', type: 'address', indexed: false }],
  },
  {
    type: 'event',
    name: 'Unpaused',
    inputs: [{ name: 'account', type: 'address', indexed: false }],
  },
] as const;
