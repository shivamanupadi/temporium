-- Recurring payment executions table
CREATE TABLE IF NOT EXISTS recurring_payment_executions (
  id TEXT PRIMARY KEY,
  recurring_payment_id TEXT NOT NULL REFERENCES recurring_payments(id),
  payment_number INTEGER NOT NULL,
  tx_hash TEXT NOT NULL,
  amount TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  executed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS rpe_recurring_id_idx ON recurring_payment_executions(recurring_payment_id);
CREATE INDEX IF NOT EXISTS rpe_tx_hash_idx ON recurring_payment_executions(tx_hash);
