/**
 * Client-side MPP (Machine Payments Protocol) helpers.
 *
 * `mppx/client` intercepts 402 Payment Required responses from any fetch
 * wrapped by its returned `mppx.fetch`. The challenge is signed by the viem
 * Account we hand it, and the request is transparently retried.
 *
 * On this app, the account comes from wagmi's `useWalletClient()` — we pass
 * the walletClient both as the viem Client (`getClient`) and as the source of
 * `account`. `polyfill: false` keeps interception scoped to `mppx.fetch`
 * instead of patching `globalThis.fetch`, so the normal authed api-client
 * keeps working unchanged.
 *
 * The helper is feature-agnostic so we can reuse it for any future mpp-gated
 * endpoint (not just payment links).
 */
import type { Client, WalletClient } from 'viem';
import { Mppx, tempo } from 'mppx/client';

/**
 * Build a scoped payment-aware fetch from a wagmi walletClient.
 * Returns `null` if the walletClient is not yet connected — the caller should
 * disable the pay button in that case.
 */
export function createMppxFetch(
  walletClient: WalletClient | null | undefined
): typeof fetch | null {
  if (!walletClient || !walletClient.account) return null;

  const mppx = Mppx.create({
    methods: [
      tempo.charge({
        account: walletClient.account,
        getClient: () => walletClient as Client,
      }),
    ],
    // Keep interception scoped to this fetch — don't touch globalThis.fetch.
    polyfill: false,
  });

  return mppx.fetch as typeof fetch;
}
