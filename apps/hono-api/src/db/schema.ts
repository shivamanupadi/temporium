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
    txHash: text('tx_hash').notNull(),
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
    executedAt: integer('executed_at', { mode: 'timestamp' }),
  },
  table => [
    index('scheduled_tx_owner_idx').on(table.owner),
    index('scheduled_tx_owner_status_idx').on(table.owner, table.status),
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
