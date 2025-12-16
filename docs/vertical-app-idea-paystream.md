# PayStream: Compliant Streaming Payroll

## The Idea

**PayStream** is a compliant, streaming payroll platform that enables businesses to pay employees and contractors in real-time or scheduled intervals using stablecoins, with built-in regulatory compliance and enterprise-grade security.

## Why This Was NOT Possible Before

Traditional blockchain payroll solutions face critical limitations:

| Challenge | Before Tempo | With Tempo |
|-----------|--------------|------------|
| **Scheduled Payments** | Requires external schedulers, cron jobs, or custodial services | Native `validAfter` mechanism for trustless scheduled transactions |
| **Compliance** | Manual KYC/AML, off-chain databases, no on-chain enforcement | TIP-403 policies enforce whitelist/blacklist on-chain |
| **User Experience** | Seed phrases, gas tokens confusion | Passkey auth + pay fees in any token |
| **Multi-Currency** | Bridge between chains, wrapped tokens | Native multi-fiat stablecoins (USD, EUR, GBP, JPY, CHF) |
| **Rewards/Bonuses** | Separate token contracts, complex distributions | Built-in token rewards system |

## Why This Is ONLY Possible on Tempo

PayStream leverages a unique combination of Tempo features that no other blockchain offers together:

### 1. Native Scheduled Transactions
```
Employee receives salary automatically on the 1st and 15th
No custodial service needed
No external schedulers or oracles
Fully trustless and on-chain
```

### 2. TIP-403 Transfer Policies (Compliance Layer)
```
Whitelist: Only verified employees can receive payroll tokens
Blacklist: Instantly block terminated employees
Audit trail: All policy changes recorded on-chain
Regulatory compliance: Built-in, not bolted-on
```

### 3. Passkey Authentication
```
No seed phrases for employees to manage
Use Touch ID, Face ID, or hardware keys
Enterprise SSO integration potential
IT-friendly onboarding
```

### 4. Fee Token Flexibility
```
Company pays all transaction fees
Employees never need to hold gas tokens
Pay fees in the same stablecoin as salary
True "paycheck" experience
```

### 5. Multi-Currency Stablecoins
```
Pay US employees in USD stablecoin
Pay EU contractors in EUR stablecoin
Pay UK team in GBP stablecoin
No cross-chain bridges needed
```

## Product Features

### For Employers

1. **Payroll Dashboard**
   - Schedule recurring payments (weekly, bi-weekly, monthly)
   - Bulk upload employee wallets
   - Set payment amounts in local fiat currencies
   - Real-time payroll status tracking

2. **Compliance Center**
   - Create employee whitelist policy
   - Automatic blacklist on termination
   - Export audit reports for regulators
   - Policy versioning and history

3. **Company Token**
   - Issue company-branded stablecoin via TIP-20 Studio
   - Link to TIP-403 policy for transfer restrictions
   - Built-in cap table management
   - Stock option distributions via rewards

### For Employees

1. **Simple Onboarding**
   - Sign up with Passkey (no seed phrase)
   - Verify identity once
   - Automatically whitelisted by employer

2. **Paycheck Experience**
   - See upcoming scheduled payments
   - Receive salary automatically
   - Never worry about gas fees
   - View payment history

3. **Flexible Spending**
   - Swap salary to other tokens via built-in DEX
   - Add liquidity to earn yield
   - Claim company rewards/bonuses

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      PayStream Platform                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Employer   │  │   Employee   │  │   Regulator  │       │
│  │  Dashboard   │  │    Portal    │  │    Viewer    │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │                │
├─────────┼─────────────────┼─────────────────┼────────────────┤
│         ▼                 ▼                 ▼                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Tempo Blockchain Layer                  │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │                                                      │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │    │
│  │  │  Scheduled  │  │   TIP-403   │  │   TIP-20    │  │    │
│  │  │Transactions │  │  Policies   │  │  Payroll    │  │    │
│  │  │             │  │             │  │   Token     │  │    │
│  │  │ - validAfter│  │ - Whitelist │  │             │  │    │
│  │  │ - Auto exec │  │ - Blacklist │  │ - Multi-fiat│  │    │
│  │  └─────────────┘  └─────────────┘  │ - Rewards   │  │    │
│  │                                    └─────────────┘  │    │
│  │  ┌─────────────┐  ┌─────────────┐                   │    │
│  │  │   Passkey   │  │  Flexible   │                   │    │
│  │  │    Auth     │  │    Fees     │                   │    │
│  │  │             │  │             │                   │    │
│  │  │ - WebAuthn  │  │ - Pay in any│                   │    │
│  │  │ - No seeds  │  │   token     │                   │    │
│  │  └─────────────┘  └─────────────┘                   │    │
│  │                                                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## User Flow Example

### Employer: Set Up Payroll

```
1. Create company account with Passkey
2. Deploy PayrollUSD token via TIP-20 Studio
3. Create employee whitelist via TIP-403 Factory
4. Link policy to PayrollUSD token
5. Add employees to whitelist
6. Schedule bi-weekly payments:
   - Alice: $5,000 USD on 1st & 15th
   - Bob: €4,000 EUR on 1st & 15th
   - Charlie: £3,500 GBP on 1st & 15th
7. Fund payroll treasury
8. Payments execute automatically - trustlessly
```

### Employee: Receive Salary

```
1. Receive invite link from employer
2. Create account with Passkey (Touch ID)
3. Automatically added to company whitelist
4. See scheduled payments in dashboard
5. Salary arrives automatically on payday
6. Optionally swap to other tokens or add liquidity
7. Claim quarterly bonuses from rewards pool
```

### Termination Flow

```
1. HR terminates employee in PayStream
2. Employee automatically added to blacklist
3. Pending scheduled payments cancelled
4. Employee can no longer receive company tokens
5. Full audit trail for compliance
```

## Market Opportunity

### Target Segments

1. **Web3 Companies** - Already paying in crypto, need compliance
2. **Remote-First Startups** - Global teams, multi-currency needs
3. **DAOs** - Contributor payments, treasury management
4. **Freelancer Platforms** - Cross-border contractor payments
5. **Traditional Companies** - Crypto-curious payroll innovation

### Competitive Advantage

| Competitor | Limitation | PayStream Advantage |
|------------|------------|---------------------|
| Bitwage | Custodial, fiat conversion | Non-custodial, native stablecoins |
| Request Network | No scheduled payments | Native scheduling |
| Superfluid | No compliance layer | TIP-403 policies |
| Traditional Payroll | Slow, expensive international | Instant, low-cost, global |

## Revenue Model

1. **SaaS Subscription** - Per employee per month
2. **Transaction Fees** - Small % on payroll volume
3. **Premium Features** - Advanced reporting, API access
4. **Enterprise** - Custom integrations, dedicated support

## Why Now?

1. **Remote work is permanent** - Global payroll is a pain point
2. **Crypto adoption growing** - More employees want crypto salary
3. **Regulatory clarity** - Stablecoins gaining acceptance
4. **Tempo is live** - Finally a blockchain with all needed primitives

## Conclusion

PayStream is only possible on Tempo because it requires the unique combination of:

- **Scheduled transactions** (no other chain has this natively)
- **Transfer policies** (compliance built into the protocol)
- **Passkey authentication** (enterprise-friendly UX)
- **Fee flexibility** (employees never need gas tokens)
- **Multi-currency stablecoins** (pay global teams in their currency)

This is not a "crypto payroll" - it's **compliant streaming payroll** that happens to use blockchain for its unique capabilities: trustless scheduling, on-chain compliance, and global instant settlement.

---

*Built on Tempo - The Payments-First Blockchain*
