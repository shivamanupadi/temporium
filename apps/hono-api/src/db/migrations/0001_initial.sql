-- Temporium API - Initial D1 Schema
-- Migrated from PostgreSQL/Prisma
-- Note: Passkeys are stored on-chain via PasskeyRegistry contract, not in D1

-- TIP-20 Contracts table
CREATE TABLE IF NOT EXISTS tip20_contracts (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  address TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  currency TEXT NOT NULL,
  creator TEXT NOT NULL,
  tx_hash TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS tip20_owner_address_idx ON tip20_contracts(owner, address);
CREATE INDEX IF NOT EXISTS tip20_owner_idx ON tip20_contracts(owner);

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS contacts_owner_address_idx ON contacts(owner, address);
CREATE INDEX IF NOT EXISTS contacts_owner_idx ON contacts(owner);

-- Scheduled Transactions table
-- Status: 'pending' | 'executed' | 'failed' (stored as TEXT)
CREATE TABLE IF NOT EXISTS scheduled_transactions (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  "from" TEXT NOT NULL,
  "to" TEXT NOT NULL,
  amount TEXT NOT NULL,
  token TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_decimals INTEGER NOT NULL,
  fee_token TEXT NOT NULL,
  memo TEXT,
  scheduled_for INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  status TEXT NOT NULL DEFAULT 'pending',
  executed_at INTEGER
);

CREATE INDEX IF NOT EXISTS scheduled_tx_owner_idx ON scheduled_transactions(owner);
CREATE INDEX IF NOT EXISTS scheduled_tx_owner_status_idx ON scheduled_transactions(owner, status);

-- Policies table
-- Type: 'whitelist' | 'blacklist' (stored as TEXT)
CREATE TABLE IF NOT EXISTS policies (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  type TEXT NOT NULL,
  admin TEXT NOT NULL,
  tx_hash TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS policies_owner_policyId_idx ON policies(owner, policy_id);
CREATE INDEX IF NOT EXISTS policies_owner_idx ON policies(owner);
