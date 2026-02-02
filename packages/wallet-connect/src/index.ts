/**
 * @temporium/wallet-connect
 *
 * SDK for connecting to Temporium Wallet from Tempo apps.
 * Uses the same parameter types as tempo.ts SDK for seamless integration.
 *
 * @example
 * ```typescript
 * import { WalletConnect } from '@temporium/wallet-connect';
 *
 * const wallet = new WalletConnect({
 *   appName: 'My App',
 *   appIcon: 'https://myapp.com/icon.png',
 * });
 *
 * // Connect to wallet
 * const { address, chainId } = await wallet.connect();
 *
 * // Send a payment (same params as useTempo().sendPayment)
 * const { hash } = await wallet.sendPayment({
 *   to: '0x...',
 *   amount: 1000000n, // 1 USD
 *   memo: 'Coffee payment',
 * });
 *
 * // Swap tokens (same params as useTempo().swapTokens)
 * const { hash } = await wallet.swapTokens({
 *   tokenIn: '0x...',
 *   tokenOut: '0x...',
 *   amountIn: 1000000n,
 *   minAmountOut: 990000n,
 * });
 * ```
 *
 * ## Migration to Other Wallets
 *
 * The SDK uses the same parameter types as tempo.ts SDK, so migrating to
 * another wallet provider requires minimal changes:
 *
 * ```typescript
 * // Before (with WalletConnect)
 * const { hash } = await wallet.sendPayment({
 *   to: '0x...',
 *   amount: 1000000n,
 * });
 *
 * // After (with useTempo hook directly)
 * const { sendPayment } = useTempo();
 * const hash = await sendPayment({
 *   to: '0x...',
 *   amount: 1000000n,
 * });
 * ```
 *
 * @packageDocumentation
 */

export { WalletConnect } from './client';
export type {
  WalletConnectConfig,
  ConnectionResult,
  ConnectionState,
  ConnectionEventType,
  ConnectionEventListener,
  SignMessageResult,
  TransactionResult,
  // Tempo SDK compatible types
  SendPaymentParams,
  SendScheduledPaymentParams,
  SwapParams,
  AddLiquidityParams,
  RemoveLiquidityParams,
  AppPermission,
} from './types';
export { WALLET_CONNECT_VERSION, WalletConnectErrorCode, WalletConnectError } from './types';
