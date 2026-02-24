-- Fix scheduled_transactions: recreate with correct schema (no defaults on serialized_tx/network)
CREATE TABLE IF NOT EXISTS scheduled_transactions_new (
  id TEXT PRIMARY KEY NOT NULL,
  owner TEXT NOT NULL,
  tx_hash TEXT,
  serialized_tx TEXT NOT NULL,
  network TEXT NOT NULL,
  "from" TEXT NOT NULL,
  "to" TEXT NOT NULL,
  amount TEXT NOT NULL,
  token TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_decimals INTEGER NOT NULL,
  fee_token TEXT NOT NULL,
  memo TEXT,
  scheduled_for INTEGER NOT NULL,
  created_at INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  executed_at INTEGER,
  fail_reason TEXT
);

INSERT INTO scheduled_transactions_new SELECT * FROM scheduled_transactions;
DROP TABLE scheduled_transactions;
ALTER TABLE scheduled_transactions_new RENAME TO scheduled_transactions;

CREATE INDEX IF NOT EXISTS scheduled_tx_owner_idx ON scheduled_transactions(owner);
CREATE INDEX IF NOT EXISTS scheduled_tx_owner_status_idx ON scheduled_transactions(owner, status);
CREATE INDEX IF NOT EXISTS scheduled_tx_owner_scheduled_idx ON scheduled_transactions(owner, scheduled_for);
