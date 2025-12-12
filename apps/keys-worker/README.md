# Tollr Keys Worker

Cloudflare Worker + D1 database for storing WebAuthn passkey public keys.

Uses `tempo.ts/server` `Handler.keyManager` for full WebAuthn attestation validation.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────┐
│  Tollr Wallet   │────▶│   Keys Worker    │────▶│  D1 (SQLite) │
│  (tempo.ts)     │     │  (tempo.ts)      │     │            │
└─────────────────┘     └──────────────────┘     └────────────┘
      │                        │
      │ KeyManager.http()      │ Handler.keyManager()
      │                        │
      ▼                        ▼
 WebAuthn Browser API    Validates attestation
                         Stores public keys
```

## API Endpoints

### GET /keys/challenge
Returns a WebAuthn registration challenge.

**Response:**
```json
{
  "challenge": "0x..."
}
```

### GET /keys/:credentialId
Retrieves the public key for a credential.

**Response:**
```json
{
  "publicKey": "0x..."
}
```

### POST /keys/:credentialId
Registers a new credential with full WebAuthn attestation validation.

**Request Body:** Full WebAuthn registration response from browser
**Response:** 200 OK on success

## Setup

### 1. Install dependencies

```bash
cd apps/keys-worker
yarn install
```

### 2. Create D1 Database

```bash
npx wrangler login
yarn db:create
```

### 3. Update wrangler.toml

Copy the `database_id` from the output and update `wrangler.toml`.

### 4. Run Database Migration

```bash
yarn db:migrate        # Production
yarn db:migrate:local  # Local development
```

### 5. Deploy

```bash
yarn deploy
```

### 6. Update Wallet Environment

```bash
# apps/wallet/.env
VITE_KEYS_API_URL=https://tollr-keys.YOUR_SUBDOMAIN.workers.dev/keys
```

## Local Development

```bash
yarn dev
```

Worker runs at `http://localhost:8787`.

## Database Schema

Simple key-value store:

```sql
CREATE TABLE passkeys (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

Keys follow patterns:
- `challenge:{hex}` - Temporary challenge storage (5 min expiry)
- `credential:{id}` - Public key storage
