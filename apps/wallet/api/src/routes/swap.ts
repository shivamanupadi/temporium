/**
 * Swap API — config endpoint for the DEX swap fee.
 *
 * Swaps themselves are client-side (browser → chain), but the fee config
 * lives server-side so it can be toggled without a frontend deploy.
 *
 * The fee token is resolved automatically from the active network:
 *   - Mainnet (4217): USDC  (0x20C000000000000000000000b9537d11c60E8b50)
 *   - Testnet (42431): pathUSD (0x20c0000000000000000000000000000000000000)
 * This mirrors the mppx SDK's `resolveCurrency()` logic.
 */
import { Hono } from 'hono';
import { success } from '../lib/response';
import type { Env, Variables } from '../types/env';

/** Default stablecoin per network — same mapping as mppx/tempo/internal/defaults. */
const NETWORK_FEE_TOKEN: Record<string, string> = {
  mainnet: '0x20C000000000000000000000b9537d11c60E8b50', // USDC
  testnet: '0x20c0000000000000000000000000000000000000', // pathUSD
};

const swapRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /v1/swap/config
 * Public — returns the swap fee config so the frontend can include the fee
 * transfer in the batch transaction. When `feeAmount === "0"` no fee is charged.
 */
swapRouter.get('/config', async c => {
  const network = c.get('networkConfig').network;
  const raw = c.env.PLATFORM_FEE_SWAP_AMOUNT ?? '0';
  const feeAmount = Number.isFinite(Number(raw)) && Number(raw) > 0 ? raw : '0';
  const feeToken = NETWORK_FEE_TOKEN[network] ?? NETWORK_FEE_TOKEN.testnet;
  const treasury = c.env.PLATFORM_REVENUE_ADDRESS ?? '';

  return success(c, { feeAmount, feeToken, treasury });
});

export default swapRouter;
