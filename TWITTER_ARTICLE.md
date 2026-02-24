# Introducing Temporium — The Smart Wallet for the Tempo Network

We've been building in silence. Today we're pulling back the curtain.

Temporium is a full-stack smart wallet built on the Tempo blockchain — passkey-secured, gasless-ready, and packed with features that make on-chain finance feel like fintech.

No seed phrases. No browser extensions. Just your fingerprint and a wallet that works.

Here's everything under the hood.

---

## 1. Passkey Authentication — Wallets Without Seed Phrases

We killed the seed phrase.

Temporium wallets are secured by passkeys — the same Face ID, Touch ID, or device PIN you already use to unlock your phone. Your private key lives in your device's secure enclave. It never leaves. It never gets exported. It syncs across your Apple/Google devices automatically.

How it works:
- You tap "Create Wallet" and authenticate with your biometrics
- A WebAuthn credential is created and registered on-chain via our PasskeyRegistry contract
- Your wallet address is derived deterministically from your public key
- Sign in on any device — your passkey syncs via iCloud Keychain or Google Password Manager

We also support browser wallets (MetaMask, Brave, etc.) for existing crypto users. But passkeys are the default because onboarding shouldn't require a 12-word backup ritual.

---

## 2. Payments — Send, Schedule, Batch, Repeat

We didn't build a wallet that can only send tokens. We built a payments engine.

**Instant Transfers**
Send any TIP-20 token to any address. Pick your fee token. Attach a memo. Done.

**Scheduled Payments**
Set a future date and time — your transaction executes automatically. Pay rent on the 1st. Settle an invoice next Friday. We handle it with Cloudflare Durable Objects that fire at the exact scheduled second, with automatic retries (up to 3 attempts) if anything goes wrong.

**Batch Payments**
Send tokens to multiple recipients in a single flow. Add addresses, set individual amounts, confirm once. Payroll for a 10-person team takes 30 seconds.

**Recurring Payments**
This is the big one. Set up automated subscriptions — recipient, token, amount, interval (every minute to every month), and optional max payment count. Our RecurringPayments smart contract uses the approve + pull pattern:

- You approve the contract to spend your tokens
- A relayer executes payments on schedule
- If you're low on balance, we skip and retry next interval (up to 10 consecutive failures before pausing)
- Missed payments are caught up automatically
- You can cancel anytime from the dashboard

Every execution is simulated first (free) before submitting on-chain. No wasted gas on transactions that would fail.

---

## 3. TIP-20 Studio — Create Your Own Stablecoin

Temporium ships with a full stablecoin creation and management toolkit.

**Create a token** — pick a name, symbol, and backing currency (USD, EUR, GBP, JPY, CHF). Deploy to Tempo in one click.

**Or import an existing one** — paste the contract address, we pull the metadata from the chain.

Once you have a token, the Studio gives you:

- **Mint** — Issue new supply to any address
- **Burn** — Destroy tokens from your balance
- **Pause/Unpause** — Freeze all transfers in an emergency
- **Supply Cap** — Set a maximum total supply
- **Role Management** — Grant and revoke roles: issuer, pause, unpause, burnBlocked, defaultAdmin
- **Burn Blocked** — Burn tokens from addresses blocked by policy
- **Rewards** — Enable reward minting and let holders claim distributions

This isn't a toy token deployer. It's a compliance-ready stablecoin management console.

---

## 4. TIP-403 Policy Factory — Programmable Transfer Restrictions

Every serious token needs transfer controls. TIP-403 is Tempo's native policy standard, and Temporium gives you a full UI to manage it.

**Create Policies:**
- **Whitelist** — Only approved addresses can send/receive
- **Blacklist** — Block specific addresses from transacting

**Manage Policies:**
- Add or remove addresses from the list
- Transfer admin rights to another address
- Check if any address is authorized or blocked
- Link a policy to any TIP-20 token you control
- Unlink when no longer needed

Build a permissioned stablecoin with KYC-gated transfers. Or a blacklist that blocks sanctioned addresses. The policy lives on-chain, enforced at the protocol level.

---

## 5. Access Keys — Session Keys with Spending Limits

Traditional wallets have one key with god-mode access. Temporium has access keys — scoped, time-limited session keys that can do only what you allow.

**Create a key with:**
- Signature type (secp256k1 or P256)
- Expiry (1 hour, 24 hours, 7 days, 30 days, or custom)
- Per-token spending limits (e.g., max 100 USDC, max 50 USDT)

**Manage keys:**
- View all active, expired, and revoked keys
- Update spending limits on the fly
- Revoke any key instantly
- Import existing on-chain keys

This is built on Tempo's AccountKeychain precompile — spending limits are enforced at the protocol level, not in a smart contract that can be bypassed.

Why does this matter? Because access keys are the foundation for:
- Delegated execution (let a bot trade for you, with a budget)
- dApp sessions (connect once, sign for 24 hours, auto-expire)
- Agent wallets (give an AI agent $100/day to spend — more on this soon)

---

## 6. Fee AMM — Swap and Provide Liquidity

Tempo has a native AMM for fee token management. Temporium gives you a clean interface to use it.

**Swap**
Rebalance between user tokens and validator tokens. The AMM offers a 0.15% bonus for swaps that help rebalance the pool — you get paid to improve the system.

**Provide Liquidity**
Deposit tokens into the AMM pool, earn your share of the 0.3% swap fee. Track your LP position, view earned fees, and withdraw anytime.

---

## 7. Token Approvals Manager

Every time you approve a contract to spend your tokens, you create a risk surface. Temporium shows you every active approval:

- Which token, which spender, how much
- Revoke any approval with one click
- Add new approvals with presets for known contracts (DEX, Factory, Fee Manager, Validator)

No more unlimited approvals you forgot about.

---

## 8. WalletConnect SDK — Connect Any dApp

We built `@temporium/wallet-connect` — a TypeScript SDK that lets any dApp connect to a Temporium wallet.

```ts
import { WalletConnect } from '@temporium/wallet-connect'

const gateway = new WalletConnect({
  appName: 'My dApp',
  permissions: ['connect', 'sign', 'send'],
})

const { address } = await gateway.connect()
```

The SDK exposes a standard viem WalletClient, so any dApp can call `Actions.*` from `viem/tempo` as if they were talking to a browser wallet. Sign messages, send transactions, interact with the DEX, AMM, and token contracts — all through a secure popup flow.

Features:
- PostMessage protocol with cross-origin security
- Connection persistence (reconnects automatically)
- Connection verification
- 60-second connection timeout, 120-second signing timeout
- Full error code system (20+ error types)
- Event system (connect/disconnect listeners)

---

## 9. Contacts & Connected Apps

**Contacts**
Save frequently-used addresses with human-readable names. Pick from your contact list when sending payments instead of pasting hex strings.

**Connected Apps**
See every dApp connected to your wallet. View activity logs (signed, sent, rejected, timed out). Revoke access with one click. Full audit trail.

---

## 10. Multi-Network & Settings

- **Network selector** — Testnet (Moderato) today, Mainnet coming soon
- **Fee token preference** — Choose your default fee token, saved on-chain
- **Custom tokens** — Add any TIP-20 by address, we pull metadata from the chain
- **Testnet faucet** — One-click free tokens for testing

---

## The Architecture

For the builders who care about the stack:

- **Frontend:** React 19, Vite, TanStack Router + Query, Zustand, Tailwind v4, Framer Motion, Radix UI
- **API:** Cloudflare Workers, Hono framework, D1 database, Drizzle ORM, Durable Objects
- **Auth:** SIWE (Sign In With Ethereum) challenge/verify → JWT
- **On-chain:** Tempo blockchain, viem/tempo Actions, WebAuthn passkeys, AccountKeychain precompile
- **Contracts:** RecurringPayments (subscription engine), PasskeyRegistry (on-chain key storage)
- **SDK:** `@temporium/wallet-connect` (postMessage protocol, viem WalletClient)
- **Monorepo:** Yarn workspaces + Turborepo

Every scheduled transaction and recurring payment runs on Cloudflare Durable Objects with:
- 2D nonce isolation (prevents relayer nonce conflicts)
- Simulation before execution (catches failures for free)
- Automatic retries with exponential backoff
- On-chain state syncing and missed payment catch-up

---

## What's Next

We're just getting started. Here's what's coming:

- **Fee Sponsorship** — Gasless transactions. Your users never need to hold native tokens. Powered by Tempo's native fee payer protocol.
- **Agent Wallets** — Give AI agents scoped access keys with spending budgets. The financial infrastructure for the agent economy.
- **Payment Links** — Generate a link, anyone can pay. No wallet setup required for the sender.
- **Agent Marketplace** — Agents discover, negotiate, and pay each other through Temporium wallets.

---

## Try It

Temporium is live on Tempo Testnet. Create a wallet in 10 seconds — no seed phrase, no extension, just your fingerprint.

We're building the wallet that makes on-chain finance feel invisible. The best UX is one where you forget you're using a blockchain.

Follow us for updates. We ship fast.

---

*Built on Tempo. Secured by passkeys. Powered by Temporium.*
