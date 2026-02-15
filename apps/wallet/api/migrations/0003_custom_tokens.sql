-- Custom tokens: user-added token addresses with on-chain metadata
CREATE TABLE IF NOT EXISTS custom_tokens (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  address TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  decimals INTEGER NOT NULL DEFAULT 6,
  logo_uri TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE UNIQUE INDEX IF NOT EXISTS custom_tokens_owner_address_idx ON custom_tokens(owner, address);
CREATE INDEX IF NOT EXISTS custom_tokens_owner_idx ON custom_tokens(owner);
