/**
 * @temporium/wallet-connect
 *
 * SDK for connecting to Temporium Wallet from Tempo apps.
 * Uses the accounts SDK Dialog adapter for secure cross-origin communication.
 *
 * @example
 * ```typescript
 * import { WalletConnect } from '@temporium/wallet-connect';
 * import { Actions } from 'viem/tempo';
 *
 * const wallet = new WalletConnect({
 *   appName: 'My App',
 *   chain: tempoModerato,
 * });
 *
 * await wallet.connect();
 * const walletClient = wallet.getWalletClient();
 *
 * const hash = await Actions.token.transfer(walletClient, {
 *   token, to, amount, feeToken,
 * });
 * ```
 *
 * @packageDocumentation
 */

export { WalletConnect } from './client';
export type {
  WalletConnectConfig,
  ConnectionResult,
  ConnectionEventType,
  ConnectionEventListener,
  // Tempo SDK compatible types
  SendPaymentParams,
  SendScheduledPaymentParams,
  SwapParams,
  AddLiquidityParams,
  RemoveLiquidityParams,
  ApproveTokenParams,
  CreateTokenParams,
  MintTokenParams,
  BurnTokenParams,
  ClaimRewardsParams,
  AmmSwapParams,
  BatchSendParams,
  BatchTransfer,
  AppPermission,
} from './types';
