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
 * // Send a payment (same params as Actions.token.transfer)
 * const { hash } = await wallet.sendPayment({
 *   to: '0x...',
 *   amount: 1000000n, // 1 USD
 *   token: '0x20c0000000000000000000000000000000000001',
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
 *   token: USD_ADDRESS,
 * });
 *
 * // After (with Actions SDK directly)
 * const hash = await Actions.token.transfer(walletClient, {
 *   to: '0x...',
 *   amount: 1000000n,
 *   token: USD_ADDRESS,
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
  BuyTokensParams,
  PlaceOrderParams,
  CancelOrderParams,
  CreatePairParams,
  ApproveTokenParams,
  CreateTokenParams,
  MintTokenParams,
  BurnTokenParams,
  ClaimRewardsParams,
  DexWithdrawParams,
  AppPermission,
} from './types';
export { WALLET_CONNECT_VERSION, WalletConnectErrorCode, WalletConnectError } from './types';
