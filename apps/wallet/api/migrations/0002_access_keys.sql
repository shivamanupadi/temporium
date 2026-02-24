-- Add new columns for DO-based scheduled transaction submission
-- serialized_tx: the signed raw transaction hex (stored in DO for execution, in D1 for reference)
-- network: 'testnet' or 'mainnet'
-- fail_reason: error message if submission fails
-- tx_hash: now nullable (null until the DO submits and gets a hash back)

-- Note: SQLite doesn't support ALTER COLUMN to make tx_hash nullable,
-- so we recreate the table.

-- Step 1: Create new table with correct schema
CREATE TABLE IF NOT EXISTS scheduled_transactions_new (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  tx_hash TEXT,
  serialized_tx TEXT NOT NULL DEFAULT '',
  network TEXT NOT NULL DEFAULT 'testnet',
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
  attempts INTEGER NOT NULL DEFAULT 0,
  executed_at INTEGER,
  fail_reason TEXT
);

-- Step 2: Copy existing data
INSERT INTO scheduled_transactions_new
  SELECT id, owner, tx_hash, '', 'testnet', "from", "to", amount, token, token_symbol, token_decimals, fee_token, memo, scheduled_for, created_at, status, 0, executed_at, NULL
  FROM scheduled_transactions;

-- Step 3: Drop old table
DROP TABLE scheduled_transactions;

-- Step 4: Rename new table
ALTER TABLE scheduled_transactions_new RENAME TO scheduled_transactions;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS scheduled_tx_owner_idx ON scheduled_transactions(owner);
CREATE INDEX IF NOT EXISTS scheduled_tx_owner_status_idx ON scheduled_transactions(owner, status);
CREATE INDEX IF NOT EXISTS scheduled_tx_owner_scheduled_idx ON scheduled_transactions(owner, scheduled_for);
