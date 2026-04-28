import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';

// Note: Passkeys are stored on-chain via PasskeyRegistry contract, not in D1

// ============ TIP-20 Contracts ============
export const tip20Contracts = sqliteTable(
  'tip20_contracts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    owner: text('owner').notNull(), // Wallet address that owns this record
    address: text('address').notNull(), // Token contract address
    name: text('name').notNull(),
    symbol: text('symbol').notNull(),
    currency: text('currency').notNull(),
    creator: text('creator').notNull(), // Token creator address
    txHash: text('tx_hash'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  },
  table => [
    uniqueIndex('tip20_owner_address_idx').on(table.owner, table.address),
    index('tip20_owner_idx').on(table.owner),
  ]
);

// ============ Contacts ============
export const contacts = sqliteTable(
  'contacts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    owner: text('owner').notNull(), // Wallet address that owns this contact
    name: text('name').notNull(),
    address: text('address').notNull(), // Contact's wallet address
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  },
  table => [
    uniqueIndex('contacts_owner_address_idx').on(table.owner, table.address),
    index('contacts_owner_idx').on(table.owner),
  ]
);

// ============ Scheduled Transactions ============
export const transactionStatusValues = ['pending', 'executed', 'failed'] as const;
export type TransactionStatus = (typeof transactionStatusValues)[number];

export const scheduledTransactions = sqliteTable(
  'scheduled_transactions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    owner: text('owner').notNull(), // Wallet address that owns this record
    txHash: text('tx_hash'), // null until executed
    serializedTx: text('serialized_tx').notNull(), // signed raw tx hex
    network: text('network').notNull(), // 'testnet' | 'mainnet'
    from: text('from').notNull(),
    to: text('to').notNull(),
    amount: text('amount').notNull(),
    token: text('token').notNull(), // Token contract address
    tokenSymbol: text('token_symbol').notNull(),
    tokenDecimals: integer('token_decimals').notNull(),
    feeToken: text('fee_token').notNull(),
    memo: text('memo'),
    scheduledFor: integer('scheduled_for', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    status: text('status').$type<TransactionStatus>().default('pending').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    executedAt: integer('executed_at', { mode: 'timestamp' }),
    failReason: text('fail_reason'), // error message on failure
  },
  table => [
    index('scheduled_tx_owner_idx').on(table.owner),
    index('scheduled_tx_owner_status_idx').on(table.owner, table.status),
    index('scheduled_tx_owner_scheduled_idx').on(table.owner, table.scheduledFor),
  ]
);

// ============ Custom Tokens ============
export const customTokens = sqliteTable(
  'custom_tokens',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    owner: text('owner').notNull(), // Wallet address that owns this record
    address: text('address').notNull(), // Token contract address
    name: text('name').notNull(),
    symbol: text('symbol').notNull(),
    decimals: integer('decimals').notNull().default(6),
    logoURI: text('logo_uri'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  },
  table => [
    uniqueIndex('custom_tokens_owner_address_idx').on(table.owner, table.address),
    index('custom_tokens_owner_idx').on(table.owner),
  ]
);

// ============ Access Keys ============
export const accessKeyTypeValues = ['secp256k1', 'p256', 'webAuthn'] as const;
export type AccessKeySignatureType = (typeof accessKeyTypeValues)[number];

export const accessKeys = sqliteTable(
  'access_keys',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    owner: text('owner').notNull(), // Wallet address that owns this key
    keyId: text('key_id').notNull(), // On-chain key address (publicKey hash)
    signatureType: text('signature_type').$type<AccessKeySignatureType>().notNull(),
    txHash: text('tx_hash'),
    label: text('label'), // Optional user-friendly label
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  },
  table => [
    uniqueIndex('access_keys_owner_keyId_idx').on(table.owner, table.keyId),
    index('access_keys_owner_idx').on(table.owner),
  ]
);

// ============ Watched Spenders ============
export const watchedSpenders = sqliteTable(
  'watched_spenders',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    owner: text('owner').notNull(), // Wallet address that owns this record
    address: text('address').notNull(), // Spender contract address
    label: text('label'), // Optional user-friendly label
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  },
  table => [
    uniqueIndex('watched_spenders_owner_address_idx').on(table.owner, table.address),
    index('watched_spenders_owner_idx').on(table.owner),
  ]
);

// ============ TIP-403 Policies ============
export const policyTypeValues = ['whitelist', 'blacklist'] as const;
export type PolicyType = (typeof policyTypeValues)[number];

export const policies = sqliteTable(
  'policies',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    owner: text('owner').notNull(), // Wallet address that owns this record
    policyId: text('policy_id').notNull(), // On-chain policy ID
    type: text('type').$type<PolicyType>().notNull(),
    admin: text('admin').notNull(), // Policy admin address
    txHash: text('tx_hash'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  },
  table => [
    uniqueIndex('policies_owner_policyId_idx').on(table.owner, table.policyId),
    index('policies_owner_idx').on(table.owner),
  ]
);

// ============ Payment Links ============
// Link-level status tracks *availability*, not payment count. Fulfillment for
// single-use links is derived from the paymentLinkPayments child table.
export const paymentLinkStatusValues = ['active', 'completed', 'cancelled', 'expired'] as const;
export type PaymentLinkStatus = (typeof paymentLinkStatusValues)[number];

export const paymentLinks = sqliteTable(
  'payment_links',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    owner: text('owner').notNull(), // wallet address that created this link
    recipient: text('recipient').notNull(), // wallet address that receives payments (may differ from owner)
    network: text('network').notNull(), // 'testnet' | 'mainnet'
    token: text('token').notNull(), // token contract address (lowercased)
    tokenSymbol: text('token_symbol').notNull(),
    tokenDecimals: integer('token_decimals').notNull(),
    amount: text('amount').notNull(), // raw base-unit string (wei-style)
    amountDecimal: text('amount_decimal').notNull(), // human decimal string
    title: text('title'),
    description: text('description'),
    reusable: integer('reusable', { mode: 'boolean' }).notNull().default(false),
    status: text('status').$type<PaymentLinkStatus>().notNull().default('active'),
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  },
  table => [
    index('payment_links_owner_idx').on(table.owner),
    index('payment_links_owner_status_idx').on(table.owner, table.status),
    index('payment_links_network_idx').on(table.network),
  ]
);

// One row per successful payment. Single-use links cap at 1; reusable accumulate.
export const paymentLinkPayments = sqliteTable(
  'payment_link_payments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    linkId: text('link_id')
      .notNull()
      .references(() => paymentLinks.id),
    payer: text('payer').notNull(),
    txHash: text('tx_hash').notNull(),
    amount: text('amount').notNull(), // gross raw base-unit amount charged to payer
    feeAmount: text('fee_amount').notNull().default('0'),
    feeBps: integer('fee_bps').notNull().default(0),
    netAmount: text('net_amount').notNull(),
    paidAt: integer('paid_at', { mode: 'timestamp' })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  table => [
    index('payment_link_payments_link_idx').on(table.linkId),
    index('payment_link_payments_payer_idx').on(table.payer),
  ]
);

export type PaymentLink = typeof paymentLinks.$inferSelect;
export type PaymentLinkPayment = typeof paymentLinkPayments.$inferSelect;

// ============ TIP-1022 Virtual Master Registration ============
// Cache of on-chain AddressRegistry state. Always reverifiable via
// publicClient.virtualAddress.getMasterAddress(masterId) — we store it to
// avoid a chain round-trip on every virtual-address create.
export const virtualMasterDiscoveredFromValues = ['portal', 'onchain'] as const;
export type VirtualMasterDiscoveredFrom = (typeof virtualMasterDiscoveredFromValues)[number];

// `pending` = mined locally, salt persisted, waiting for user wallet to broadcast registerVirtualMaster.
// `registered` = on-chain confirmation observed.
// Pending rows let us resume the registration wizard if the user closes the
// tab between mining and signing. Added in migration 0003.
export const virtualMasterStatusValues = ['pending', 'registered'] as const;
export type VirtualMasterStatus = (typeof virtualMasterStatusValues)[number];

export const virtualMasters = sqliteTable(
  'virtual_masters',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    owner: text('owner').notNull(), // wallet address (lowercased)
    masterId: text('master_id').notNull(), // bytes4 hex, e.g. "0x07a3b1c2"
    salt: text('salt'), // bytes32 hex; null when linked from elsewhere (event scan / lookup)
    txHash: text('tx_hash'), // null while pending or when discovered via lookup
    status: text('status').$type<VirtualMasterStatus>().notNull().default('registered'),
    discoveredFrom: text('discovered_from')
      .$type<VirtualMasterDiscoveredFrom>()
      .notNull()
      .default('portal'),
    network: text('network').notNull(), // 'testnet' | 'mainnet'
    registeredAt: integer('registered_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  },
  table => [
    uniqueIndex('virtual_masters_owner_idx').on(table.owner),
    uniqueIndex('virtual_masters_master_id_idx').on(table.masterId),
  ]
);

// ============ TIP-1022 Virtual Addresses ============
// Off-chain bookkeeping for the operator-managed userTag -> label mapping.
// This data exists nowhere on-chain: userTags are generated client-/server-side
// without a transaction per the TIP-1022 spec.
export const virtualAddresses = sqliteTable(
  'virtual_addresses',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    owner: text('owner').notNull(), // wallet address (lowercased)
    masterId: text('master_id').notNull(), // bytes4 hex (denormalized from virtualMasters)
    userTag: text('user_tag').notNull(), // bytes6 hex
    address: text('address').notNull(), // composed 20-byte address, lowercased
    label: text('label').notNull(), // 1-64 chars, required
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  },
  table => [
    uniqueIndex('virtual_addresses_owner_address_idx').on(table.owner, table.address),
    index('virtual_addresses_owner_created_idx').on(table.owner, table.createdAt),
  ]
);

export type VirtualMaster = typeof virtualMasters.$inferSelect;
export type VirtualAddress = typeof virtualAddresses.$inferSelect;
