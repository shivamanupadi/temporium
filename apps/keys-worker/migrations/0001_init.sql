-- Passkeys table for storing WebAuthn public keys
CREATE TABLE IF NOT EXISTS passkeys (
  credential_id TEXT PRIMARY KEY,
  public_key TEXT NOT NULL,
  wallet_address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Index for looking up by wallet address (for future features)
CREATE INDEX IF NOT EXISTS idx_wallet_address ON passkeys(wallet_address);
