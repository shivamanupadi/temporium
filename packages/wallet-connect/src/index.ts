/**
 * @temporium/wallet-connect
 *
 * SDK for connecting to Temporium Wallet from Tempo apps.
 * Exposes a standard viem WalletClient for use with Actions.* from viem/tempo.
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
  ConnectionState,
  ConnectionEventType,
  ConnectionEventListener,
  SignMessageResult,
  TransactionResult,
  SignTransactionResult,
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
  AmmSwapParams,
  BatchSendParams,
  BatchTransfer,
  AppPermission,
} from './types';
export { WALLET_CONNECT_VERSION, WalletConnectErrorCode, WalletConnectError } from './types';
