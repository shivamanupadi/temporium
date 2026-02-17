/**
 * @temporium/gateway-connect
 *
 * SDK for connecting to Temporium Gateway from Tempo apps.
 * Exposes a standard viem WalletClient for use with Actions.* from viem/tempo.
 *
 * @example
 * ```typescript
 * import { GatewayConnect } from '@temporium/gateway-connect';
 * import { Actions } from 'viem/tempo';
 *
 * const gateway = new GatewayConnect({
 *   appName: 'My App',
 *   chain: tempoModerato,
 * });
 *
 * await gateway.connect();
 * const walletClient = gateway.getWalletClient();
 *
 * const hash = await Actions.token.transfer(walletClient, {
 *   token, to, amount, feeToken,
 * });
 * ```
 *
 * @packageDocumentation
 */

export { GatewayConnect } from './client';
// Backward-compat alias
export { GatewayConnect as WalletConnect } from './client';
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
