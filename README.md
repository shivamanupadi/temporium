# Temporium

**Your gateway to Tempo — a passkey-secured, payments-first web wallet and toolkit for the Tempo blockchain.**

Temporium is a complete wallet for [Tempo](https://docs.tempo.xyz), the
stablecoin-native, payments-oriented EVM chain. Send, receive, schedule, and
batch payments with sub-cent fees; create and manage TIP-20 tokens; issue
scoped access keys; and mint virtual deposit addresses — all secured by
passkeys (Face ID / Touch ID), with no seed phrases to lose.

Live at [temporium.xyz](https://temporium.xyz).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)
![Built on Cloudflare](https://img.shields.io/badge/built%20on-Cloudflare-orange)

## Highlights

- **Passkey wallets, no seed phrases** — a WebAuthn passkey is your wallet.
  The public key is registered in an on-chain `PasskeyRegistry` contract
  (1 passkey = 1 wallet, address derived from the key), so access is
  recoverable from the chain while the private key never leaves your device.
  Registration is relayer-sponsored — new users pay nothing to start.
- **Payments-first** — instant transfers with memos, QR receive with
  pre-filled amounts, multi-recipient **batch payments** (payroll, airdrops),
  **scheduled payments** (Durable Object alarms with retries), and shareable
  **payment links** — on-chain invoices, single-use or reusable, settled via
  the Machine Payments Protocol (HTTP 402 challenge → sign → settle).
- **Token tools** — **TIP-20 Studio** (create, mint, burn, pause, supply
  caps, roles, transfer restrictions, rewards), **TIP-403 factory** for
  access-controlled token policies, custom token imports, and an approvals
  viewer.
- **Access keys** — delegate scoped signing to apps with sub-keys that carry
  expiries and per-token spending limits, plus watched-spender alerts.
- **Virtual addresses (TIP-1022)** — register a master address once, then
  mint unlimited off-chain virtual deposit addresses that auto-forward to it.
  The proof-of-work registration salt is mined server-side in a Cloudflare
  Container so the browser never grinds hashes.
- **DEX swaps** — stablecoin pair swaps with direct or multi-hop routing.
- **Stablecoin gas** — fees are paid in stablecoins (pathUSD by default),
  with a per-account fee-token preference via Tempo's `FeeManager`.

## Architecture

Everything runs on Cloudflare — no servers to manage.

```
browser (React 19 + Vite + wagmi/viem)          apps/wallet/web
  │  passkey (WebAuthn) / injected / Tempo Wallet connectors
  │  REST + JWT (SIWE-style challenge → verify)
  ▼
api Worker (Hono 4)                             apps/wallet/api
  ├─ D1 (Drizzle ORM) ── contacts, access keys, payment links,
  │                      scheduled txs, custom tokens, policies,
  │                      virtual addresses, TIP-20 registry
  ├─ ScheduledTransactionDO ── alarm-driven future tx submission (3 retries)
  ├─ MineSaltContainer ── PoW salt mining for TIP-1022 registration
  ├─ relayer ── sponsors PasskeyRegistry writes
  └─ tokenlist proxy ── tokenlist.tempo.xyz
  ▼
Tempo blockchain                                apps/wallet/contracts
  └─ PasskeyRegistry.sol (Foundry) ── credentialIdHash → {publicKey, wallet}
```

One Worker serves both networks; the active network is selected per-request
with the `X-Tempo-Network` header:

| Network | Chain ID | RPC |
|---|---|---|
| Tempo mainnet | 4217 | `https://rpc.tempo.xyz` |
| Moderato testnet | 42431 | `https://rpc.moderato.tempo.xyz` |

## Repository layout

```
apps/wallet/
  api/         Cloudflare Worker API — Hono, D1 + Drizzle, Durable Objects,
               Containers, JWT auth, mppx (HTTP 402) payments
  web/         React 19 SPA — Vite, TanStack Router/Query, Tailwind v4,
               Radix UI, wagmi 3 + viem 2 (deployed to Cloudflare Pages)
  contracts/   Foundry — PasskeyRegistry.sol + deploy scripts
packages/
  shared-ui/           shared React components
  eslint-config/       shared lint config
  typescript-config/   shared tsconfigs
```

Monorepo managed with Yarn workspaces + Turborepo. Requires Node ≥ 22.
`apps/wallet/contracts/lib/forge-std` is a git submodule — clone with
`--recurse-submodules`.

## Getting started

```sh
yarn install          # also runs patch-package + a viem/ox patch
yarn dev:wallet       # api on :8008, web on :8009
```

Secrets are managed with [Doppler](https://doppler.com); the dev scripts
fetch them before starting `wrangler dev` / `vite`. Without Doppler access,
create `apps/wallet/api/.dev.vars` from `.env.example` and set:

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | signs session JWTs issued after passkey/SIWE auth |
| `MPP_SECRET_KEY` | HMAC key binding Machine Payments Protocol 402 challenges |
| `RELAYER_PRIVATE_KEY` | funded EOA that sponsors `PasskeyRegistry` writes |
| `PASSKEY_REGISTRY_CONTRACT` | deployed registry address |

None of these are ever committed; in production they are synced to
`wrangler secret` at deploy time.

### Database

```sh
yarn db:generate                                   # drizzle-kit migration
yarn workspace @temporium/wallet-api db:local:migrate
yarn db:check                                      # schema-drift guard (also runs in CI)
```

### Contracts

```sh
cd apps/wallet/contracts
forge build
./deploy-passkey-registry-contract.sh --dev --testnet
```

`PasskeyRegistry.sol` is an owner-only registry mapping
`credentialIdHash → {publicKey, wallet, createdAt}`; the wallet address is
the low 160 bits of `keccak256(publicKey)`, duplicate keys are rejected, and
each registration emits `PasskeyRegistered`.

### Checks

```sh
yarn lint          # eslint across all workspaces
yarn type-check    # tsc across all workspaces
yarn build         # full build
yarn check:push    # lint + build (runs on pre-push)
```

## Deployment

- **API** — `yarn workspace @temporium/wallet-api release:prod`: applies D1
  migrations remotely, bulk-syncs secrets, and deploys the Worker.
- **Web** — `yarn release:prod:web`: production build (with a guard that
  refuses to deploy unless the API URL was inlined and is HTTPS), then
  `wrangler pages deploy`.

## Tempo standards used

| Standard | What it is | Where |
|---|---|---|
| TIP-20 | fungible token standard | TIP-20 Studio, rewards, approvals |
| TIP-403 | access-controlled / policy tokens | policy factory |
| TIP-1022 | virtual forwarding addresses | virtual-address routes + PoW container |

## Contributing

Issues and pull requests are welcome. Please run `yarn check:push` before
opening a PR and keep changes focused.

## License

[MIT](LICENSE) © 2026 Shivaprasad Manupadi
