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

// ============ Recurring Payments ============
export const recurringPaymentStatusValues = [
  'active',
  'paused',
  'completed',
  'cancelled',
  'failed',
] as const;
export type RecurringPaymentStatus = (typeof recurringPaymentStatusValues)[number];

export const recurringPayments = sqliteTable(
  'recurring_payments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    owner: text('owner').notNull(), // Wallet address that owns this subscription
    recipient: text('recipient').notNull(), // Payment recipient address
    token: text('token').notNull(), // TIP-20 token contract address
    tokenSymbol: text('token_symbol').notNull(),
    tokenDecimals: integer('token_decimals').notNull(),
    amount: text('amount').notNull(), // Amount per payment (wei string)
    intervalSeconds: integer('interval_seconds').notNull(), // Seconds between payments
    maxPayments: integer('max_payments').notNull().default(0), // 0 = unlimited
    paymentsMade: integer('payments_made').notNull().default(0),
    subscriptionId: integer('subscription_id'), // On-chain subscription ID from RecurringPayments contract
    contractAddress: text('contract_address').notNull(), // RecurringPayments contract address
    network: text('network').notNull(), // 'testnet' | 'mainnet'
    status: text('status').$type<RecurringPaymentStatus>().default('active').notNull(),
    nextPaymentAt: integer('next_payment_at', { mode: 'timestamp' }).notNull(),
    lastPaidAt: integer('last_paid_at', { mode: 'timestamp' }),
    txHash: text('tx_hash'), // Creation tx hash
    label: text('label'), // Optional user-friendly label
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    failReason: text('fail_reason'),
  },
  table => [
    index('recurring_owner_idx').on(table.owner),
    index('recurring_owner_status_idx').on(table.owner, table.status),
  ]
);

// ============ Recurring Payment Executions ============
export const recurringPaymentExecutions = sqliteTable(
  'recurring_payment_executions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    recurringPaymentId: text('recurring_payment_id')
      .notNull()
      .references(() => recurringPayments.id),
    paymentNumber: integer('payment_number').notNull(),
    txHash: text('tx_hash').notNull(),
    amount: text('amount').notNull(),
    status: text('status').notNull().default('confirmed'),
    executedAt: integer('executed_at', { mode: 'timestamp' }).notNull(),
  },
  table => [
    index('rpe_recurring_id_idx').on(table.recurringPaymentId),
    index('rpe_tx_hash_idx').on(table.txHash),
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
