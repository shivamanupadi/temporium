/**
 * MPP (Machine Payments Protocol) helpers — wraps `mppx/server` for reuse
 * across payment-gated features.
 *
 * The core pattern:
 *   const mppx = createMppx({ currency, decimals, testnet, secretKey });
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

/** Per-network treasury + fee rate resolution. */
export interface PlatformFeeConfig {
  /** Fee rate in basis points (100 = 1%). Zero means fee is dormant. */
  feeBps: number;
  /** Fee recipient address; empty string when dormant. */
  treasury: string;
}

/**
 * Read platform-fee settings out of env for the given network.
 * At launch, `PLATFORM_FEE_BPS` defaults to "0" and treasury strings are empty —
 * the pay handler will skip splits entirely in that state.
 */
export function getPlatformFeeConfig(env: Env, network: 'testnet' | 'mainnet'): PlatformFeeConfig {
  const raw = env.PLATFORM_FEE_BPS ?? '0';
  const feeBps = Number.isFinite(Number(raw)) ? Number(raw) : 0;
  const treasury =
    network === 'mainnet'
      ? (env.MAINNET_PLATFORM_TREASURY_ADDRESS ?? '')
      : (env.TESTNET_PLATFORM_TREASURY_ADDRESS ?? '');
  return { feeBps, treasury };
}

/**
 * Compute the raw fee amount (base units) from a gross amount and bps rate.
 * Uses bigint floor division so the creator always receives at least the
 * rounded-down residual — never ends up underwater.
 */
export function computeFeeAmount(grossRaw: bigint, feeBps: number): bigint {
  if (feeBps <= 0) return 0n;
  return (grossRaw * BigInt(feeBps)) / 10000n;
}

/** Generic MPP instance for any currency+decimals combo. Reusable for future features. */
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

/** Convenience: create an Mppx instance configured for a specific PaymentLink. */
export function createMppxForLink(link: PaymentLink, env: Env) {
  const secretKey = env.MPP_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      'MPP_SECRET_KEY is not configured — set it in .dev.vars (local) or via `wrangler secret put MPP_SECRET_KEY` (deployed)'
    );
  }
  // Fixed realm keyed on network so challenges issued on testnet can't be
  // replayed on mainnet and vice versa.
  const realm = `temporium-payment-links:${link.network}`;
  return createMppx({
    currency: link.token as Address,
    decimals: link.tokenDecimals,
    testnet: link.network === 'testnet',
    secretKey,
    realm,
  });
}
