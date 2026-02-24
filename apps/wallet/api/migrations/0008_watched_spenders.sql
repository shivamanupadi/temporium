-- Watched spenders: user-saved spender contracts for persistent approval tracking
CREATE TABLE IF NOT EXISTS watched_spenders (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  address TEXT NOT NULL,
  label TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS watched_spenders_owner_address_idx ON watched_spenders(owner, address);
CREATE INDEX IF NOT EXISTS watched_spenders_owner_idx ON watched_spenders(owner);
