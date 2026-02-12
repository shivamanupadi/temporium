/**
 * @temporium/gateway-connect
 *
 * SDK for connecting to Temporium Gateway from Tempo apps.
 * Uses the same parameter types as tempo.ts SDK for seamless integration.
 *
 * @example
 * ```typescript
 * import { GatewayConnect } from '@temporium/gateway-connect';
 *
 * const gateway = new GatewayConnect({
 *   appName: 'My App',
 *   appIcon: 'https://myapp.com/icon.png',
 * });
 *
 * // Connect to gateway
 * const { address, chainId } = await gateway.connect();
 *
 * // Send a payment (same params as Actions.token.transfer)
 * const { hash } = await gateway.sendPayment({
 *   to: '0x...',
 *   amount: 1000000n, // 1 USD
 *   token: '0x20c0000000000000000000000000000000000001',
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
  AppPermission,
} from './types';
export { WALLET_CONNECT_VERSION, WalletConnectErrorCode, WalletConnectError } from './types';
