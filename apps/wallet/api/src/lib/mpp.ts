/**
 * MPP (Machine Payments Protocol) helpers — wraps `mppx/server` for reuse
 * across payment-gated features (payment links, scheduled payments, etc.).
 *
 * The core pattern:
 *   const mppx = createMppx({ currency, decimals, testnet, secretKey, realm });
 *   const result = await mppx.charge(chargeOpts)(request);
 *   if (result.status === 402) return result.challenge;
 *   return result.withReceipt(response);
 *
 * `tempo.charge()` takes defaults (currency + decimals + chain info) at method
 * construction time; per-request `mppx.charge({ amount, recipient, splits? })`
 * supplies the payment-specific fields.
 */
import { Mppx, tempo } from 'mppx/server';
import type { Address } from 'viem';
import type { Env } from '../types/env';
import type { PaymentLink } from '../db/schema';

// =============================================================================
// Platform fee resolution
// =============================================================================

/** Platform revenue wallet + fee rate resolution. */
export interface PlatformFeeConfig {
  /** Fee rate in basis points (100 = 1%). Zero means fee is dormant. */
  feeBps: number;
  /** Fee recipient address; empty string when dormant. */
  treasury: string;
}

/** Parse a basis-points env var string into a safe number. */
function parseBps(raw: string | undefined): number {
  const n = Number(raw ?? '0');
  return Number.isFinite(n) ? n : 0;
}

/** Fee config for payment links. */
export function getPaymentLinkFeeConfig(env: Env): PlatformFeeConfig {
  return {
    feeBps: parseBps(env.PLATFORM_FEE_PAYMENT_LINK_BPS),
    treasury: env.PLATFORM_REVENUE_ADDRESS ?? '',
  };
}

/** Flat fee config for scheduled payments. */
export interface ScheduledTxFeeConfig {
  /** Flat fee in token decimal units (e.g. "0.1"). Empty or "0" means dormant. */
  feeAmount: string;
  /** Fee recipient address; empty string when dormant. */
  treasury: string;
}

export function getScheduledTxFeeConfig(env: Env): ScheduledTxFeeConfig {
  const raw = env.PLATFORM_FEE_SCHEDULE_TXN_AMOUNT ?? '0';
  const feeAmount = Number.isFinite(Number(raw)) && Number(raw) > 0 ? raw : '0';
  return { feeAmount, treasury: env.PLATFORM_REVENUE_ADDRESS ?? '' };
}

/**
 * @deprecated Use feature-specific helpers (`getPaymentLinkFeeConfig`, `getScheduledTxFeeConfig`).
 */
export const getPlatformFeeConfig = getPaymentLinkFeeConfig;

/**
 * Compute the raw fee amount (base units) from a gross amount and bps rate.
 * Uses bigint floor division so the creator always receives at least the
 * rounded-down residual — never ends up underwater.
 */
export function computeFeeAmount(grossRaw: bigint, feeBps: number): bigint {
  if (feeBps <= 0) return 0n;
  return (grossRaw * BigInt(feeBps)) / 10000n;
}

// =============================================================================
// Mppx instance factory
// =============================================================================

export interface CreateMppxOpts {
  /** TIP-20 token contract address. */
  currency: Address;
  /** Token decimals (matches on-chain ERC-20 decimals). */
  decimals: number;
  /** Whether the payment targets Tempo Moderato (testnet). */
  testnet: boolean;
  /** HMAC secret that binds issued challenges to this server. */
  secretKey: string;
  /**
   * Server realm pinned into the HMAC. mppx defaults to the request's Host
   * header, which can drift between the 402 issue call and the credential
   * verify call (e.g. `localhost:8008` vs `127.0.0.1:8008`, or an added port
   * by a proxy) — any drift invalidates the HMAC and the client sees
   * "challenge was not issued by this server". Pin it explicitly to avoid.
   */
  realm: string;
}

export function createMppx(opts: CreateMppxOpts) {
  return Mppx.create({
    methods: [
      tempo.charge({
        currency: opts.currency,
        decimals: opts.decimals,
        testnet: opts.testnet,
      }),
    ],
    secretKey: opts.secretKey,
    realm: opts.realm,
  });
}

/**
 * Resolve MPP_SECRET_KEY from env, throwing a descriptive error if missing.
 * Shared by all feature-specific factory helpers below.
 */
function requireSecretKey(env: Env): string {
  const key = env.MPP_SECRET_KEY;
  if (!key) {
    throw new Error(
      'MPP_SECRET_KEY is not configured — set it in .dev.vars (local) or via `wrangler secret put MPP_SECRET_KEY` (deployed)'
    );
  }
  return key;
}

/** Create an Mppx instance configured for a PaymentLink. */
export function createMppxForLink(link: PaymentLink, env: Env) {
  return createMppx({
    currency: link.token as Address,
    decimals: link.tokenDecimals,
    testnet: link.network === 'testnet',
    secretKey: requireSecretKey(env),
    realm: `temporium-payment-links:${link.network}`,
  });
}

/** Create an Mppx instance for a scheduled-payment service fee. */
export function createMppxForScheduledTx(
  token: Address,
  tokenDecimals: number,
  network: 'testnet' | 'mainnet',
  env: Env
) {
  return createMppx({
    currency: token,
    decimals: tokenDecimals,
    testnet: network === 'testnet',
    secretKey: requireSecretKey(env),
    realm: `temporium-scheduled-txs:${network}`,
  });
}
