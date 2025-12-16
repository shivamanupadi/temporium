# PinkyPay: Social IOUs That Actually Get Paid

## The One-Liner

**"Venmo requests with a scheduled auto-collect date"**

Your friend owes you $20 for pizza. Send a PinkyPay link. They tap to approve. Money auto-transfers on Friday. Done.

---

## Why This Is ONLY Possible on Tempo

| Feature | Why PinkyPay Needs It | Other Chains? |
|---------|----------------------|---------------|
| **Scheduled Transactions** | Auto-collect on the agreed date | No - need oracles/custodians |
| **Passkey Auth** | Friends sign up with Touch ID, no crypto knowledge | No - seed phrases required |
| **Fee Flexibility** | Sender covers fees, receiver pays nothing | No - both need gas tokens |
| **Native Stablecoins** | Owe $20 = pay $20, not 0.0067 ETH | Partial - need bridges |

**The magic**: Your non-crypto friend can approve a payment with Face ID and forget about it. Tempo handles the rest.

---

## The Viral Loop

```
Alice pays for dinner ($80 split 4 ways)
     ↓
Alice sends 3 PinkyPay links ($20 each)
     ↓
Bob, Carol, Dave tap to approve (Passkey = 2 seconds)
     ↓
They see: "You owe Alice $20 - auto-pays Friday"
     ↓
Friday: Money moves automatically
     ↓
Bob thinks: "This is genius" → Uses it for his IOUs
     ↓
Network effect: Every IOU creates 2 users
```

**Virality mechanics:**
- Every payment involves 2 people (sender + receiver)
- Relatable problem everyone has (friends who "forget" to pay)
- Shareable moment: "Just PinkyPay'd my roommate for utilities"
- Slight social pressure: "Pay by Friday or it auto-collects"

---

## MVP Scope (One Developer, 2-3 Weeks)

### Week 1: Core Flow
```
- Landing page with "Create IOU" button
- Passkey signup/login (use existing Tempo auth)
- Create IOU: amount + recipient + due date
- Generate shareable link
```

### Week 2: Recipient Flow
```
- Recipient clicks link
- One-tap Passkey signup
- Approve scheduled payment
- Dashboard showing pending IOUs
```

### Week 3: Polish
```
- Push notifications (due date reminders)
- IOU history
- Cancel/modify flow
- Share to socials
```

### Tech Stack
```
Frontend: React (reuse Tempo Gateway components)
Backend: Minimal - mostly blockchain calls
Auth: Tempo Passkey (already built)
Payments: Tempo scheduled transactions (already built)
```

---

## User Flow

### Creating an IOU

```
1. Open pinkypay.xyz
2. Sign in with Passkey (Touch ID)
3. Enter: "Bob owes me $20 for pizza"
4. Set auto-collect date: "Friday"
5. Get link: pinkypay.xyz/owe/abc123
6. Text link to Bob
```

### Accepting an IOU

```
1. Bob clicks link
2. Sees: "Alice says you owe $20 for pizza"
3. Taps "Approve" → Passkey prompt (Face ID)
4. Done. Auto-pays Friday.
5. Bob can add funds anytime before Friday
```

### The "Magic" Moment

```
Friday arrives
Bob's phone buzzes: "Paid Alice $20"
Alice's phone buzzes: "Bob paid you $20"
Neither had to remember or do anything
```

---

## Why It Will Work

### 1. Solves a Real Problem
- 73% of Americans have lent money to friends
- Average person is owed $500+ by friends/family
- Venmo requests get ignored (no consequence)

### 2. Zero Friction
- No app download (PWA/web)
- No crypto knowledge needed
- No gas tokens to buy
- Passkey = already on their phone

### 3. Social Dynamics
- Soft accountability (they agreed to a date)
- No awkward "hey you owe me" texts
- Makes splitting things automatic

### 4. Viral by Design
- 2 users per transaction minimum
- Shareable links
- Solves universal pain point
- Easy to explain: "IOU with auto-collect"

---

## Growth Playbook

### Launch
1. Post on Twitter/X: "Built this because my friends never pay me back"
2. Share relatable memes about friends owing money
3. Launch on Product Hunt

### Viral Mechanics
- "Share your PinkyPay link" in bio
- Leaderboard: "Most reliable payers among your friends"
- Badges: "Always pays on time"

### Expansion
- Group splits (dinner with 6 people)
- Recurring IOUs (monthly rent from roommate)
- Business mode (freelancer invoices)

---

## Why Not Just Venmo?

| Venmo | PinkyPay |
|-------|----------|
| Send request, hope they pay | Set date, it auto-collects |
| They can ignore forever | They agreed to a deadline |
| Awkward to follow up | No follow-up needed |
| Need app installed | Just a web link |
| US only | Global (stablecoins) |

---

## Revenue Model (Later)

1. **Free tier**: 5 IOUs/month
2. **Pro ($5/mo)**: Unlimited IOUs
3. **Take rate**: 1% on amounts > $100

But focus on growth first. Revenue comes from scale.

---

## Success Probability: HIGH

| Factor | Assessment |
|--------|------------|
| Market | Universal problem |
| Competition | No one does scheduled P2P |
| Technical | Uses existing Tempo primitives |
| Viral | Built into the product |
| Scope | One dev can ship MVP |
| Timing | Stablecoins going mainstream |

---

## The Pitch

> "Remember when your friend said they'd pay you back Friday?
> PinkyPay makes sure they actually do.
>
> Send a link. They approve. Money moves on the date.
> No chasing. No awkwardness. No excuses."

---

## Summary

**PinkyPay** is the smallest possible product that leverages Tempo's unique capabilities:

- **Scheduled transactions** → Auto-collect on due date
- **Passkey auth** → Non-crypto friends can use it
- **Fee flexibility** → No gas token confusion
- **Stablecoins** → $20 means $20

One developer. 2-3 weeks. Solves a universal problem. Viral by design.

---

*Built on Tempo - Because friends shouldn't have to remind friends.*
