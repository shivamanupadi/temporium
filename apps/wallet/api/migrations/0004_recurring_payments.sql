-- Recurring payments table
CREATE TABLE IF NOT EXISTS recurring_payments (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  recipient TEXT NOT NULL,
  token TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_decimals INTEGER NOT NULL,
  amount TEXT NOT NULL,
  interval_seconds INTEGER NOT NULL,
  max_payments INTEGER NOT NULL DEFAULT 0,
  payments_made INTEGER NOT NULL DEFAULT 0,
  subscription_id INTEGER,
  contract_address TEXT NOT NULL,
  network TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  next_payment_at INTEGER NOT NULL,
  last_paid_at INTEGER,
  tx_hash TEXT,
  label TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_recurring_owner ON recurring_payments(owner);
CREATE INDEX IF NOT EXISTS idx_recurring_owner_status ON recurring_payments(owner, status);
