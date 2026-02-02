# Wallet Connect Example

A simple example app demonstrating how to use `@temporium/wallet-connect` SDK.

## Running the Example

1. First, start the wallet app (from the repo root):
   ```bash
   cd apps/wallet/web
   yarn dev
   ```

2. Then, start this example app:
   ```bash
   cd packages/wallet-connect/example
   yarn dev
   ```

3. Open http://localhost:5173 in your browser

## Features Demonstrated

- **Connect Wallet** - Authenticate with Temporium Wallet
- **Sign Message** - Sign arbitrary messages
- **Send Payment** - Send USD payments with optional memo

## Code Usage

```typescript
import { WalletConnect } from '@temporium/wallet-connect';

// Initialize the client
const wallet = new WalletConnect({
  appName: 'My App',
  appIcon: 'https://myapp.com/icon.png',
  // Optional: use local wallet for development
  walletUrl: 'http://localhost:4004',
});

// Connect to wallet
const { address, chainId } = await wallet.connect();
console.log('Connected:', address);

// Sign a message
const { signature } = await wallet.signMessage('Hello World');
console.log('Signature:', signature);

// Send a payment
const { hash } = await wallet.sendPayment({
  to: '0x1234...5678',
  amount: 1000000n, // 1 USD (6 decimals)
  memo: 'Coffee payment',
});
console.log('Transaction:', hash);

// Cleanup when done
wallet.destroy();
```

## Available Methods

| Method | Description |
|--------|-------------|
| `connect()` | Connect to wallet, returns address and chainId |
| `disconnect()` | Disconnect from wallet |
| `signMessage(message)` | Sign a message, returns signature |
| `sendPayment(params)` | Send a token payment |
| `sendScheduledPayment(params)` | Send a scheduled payment |
| `swapTokens(params)` | Swap tokens on DEX |
| `addLiquidity(params)` | Add liquidity to pool |
| `removeLiquidity(params)` | Remove liquidity from pool |
