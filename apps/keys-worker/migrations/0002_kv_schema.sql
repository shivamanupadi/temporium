-- Drop old passkeys table and create new KV-style table
DROP TABLE IF EXISTS passkeys;

-- Simple key-value table for tempo.ts Kv interface
CREATE TABLE passkeys (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
