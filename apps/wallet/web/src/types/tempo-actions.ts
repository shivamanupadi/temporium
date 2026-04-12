import type { Address } from 'viem';

/**
 * Parameter shapes for Tempo chain actions used by the `useTempo` hook.
 * These mirror the Actions exposed by the on-chain helpers in `@/lib/tempo-client`.
 */

export interface SendPaymentParams {
  to: Address;
  amount: bigint;
  token: Address;
  feeToken?: Address;
  memo?: `0x${string}`;
}

export interface SendScheduledPaymentParams extends SendPaymentParams {
  scheduledFor: number;
}

export interface AddLiquidityParams {
  userTokenAddress: Address;
  validatorTokenAddress: Address;
  validatorTokenAmount: bigint;
  feeToken?: Address;
}

export interface RemoveLiquidityParams {
  userTokenAddress: Address;
  validatorTokenAddress: Address;
  liquidity: bigint;
  feeToken?: Address;
}

export interface ApproveTokenParams {
  token: Address;
  spender: Address;
  amount: bigint;
  feeToken?: Address;
}

export interface CreateTokenParams {
  name: string;
  symbol: string;
  currency: string;
  admin?: Address;
  quoteToken?: Address;
  salt?: `0x${string}`;
}

export interface MintTokenParams {
  token: Address;
  to: Address;
  amount: bigint;
  memo?: `0x${string}`;
  feeToken?: Address;
}

export interface BurnTokenParams {
  token: Address;
  amount: bigint;
  memo?: `0x${string}`;
  feeToken?: Address;
}

export interface ClaimRewardsParams {
  token: Address;
  feeToken?: Address;
}

export interface BatchTransfer {
  to: Address;
  amount: bigint;
  memo?: `0x${string}`;
}

export interface BatchSendParams {
  token: Address;
  transfers: BatchTransfer[];
  feeToken?: Address;
}

export interface AmmSwapParams {
  userToken: Address;
  validatorToken: Address;
  amountOut: bigint;
  feeToken?: Address;
}
