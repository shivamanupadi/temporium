/**
 * Payment Links API
 *
 * Authenticated users create fixed-amount payment links (single-use or
 * reusable). Each link exposes a public pay endpoint gated by mppx (Machine
 * Payments Protocol) — a payer sends a standard POST, gets back a 402
 * challenge, signs it via their wallet, and the server records the payment
 * once on-chain settlement completes.
 *
 * Routes:
 *   GET    /v1/payment-links/config              (public) — fee bps for UI
 *   GET    /v1/payment-links/public/:id          (public) — payer view
 *   POST   /v1/payment-links/public/:id/pay      (public) — mppx-gated pay
 *   GET    /v1/payment-links                     (auth)   — list own links
 *   POST   /v1/payment-links                     (auth)   — create link
 *   GET    /v1/payment-links/:id                 (auth)   — get with payments
 *   DELETE /v1/payment-links/:id                 (auth)   — soft cancel
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import { formatUnits, parseUnits, type Address } from 'viem';
import { Receipt } from 'mppx';

import { jwtAuth, getWalletAddress } from '../middleware/auth';
import { BadRequestError, NotFoundError, InternalError } from '../middleware/error';
import { createDb, paymentLinks, paymentLinkPayments } from '../db';
import type { PaymentLink } from '../db/schema';
import { createPaymentLinkSchema, paymentLinkQuerySchema, idParamSchema } from '../lib/validation';
import { success, paginated, noContent } from '../lib/response';
import { getPlatformFeeConfig, computeFeeAmount, createMppxForLink } from '../lib/mpp';
import { resolveAllowedToken } from '../lib/payment-link-tokens';
import type { Env, Variables } from '../types/env';

const paymentLinksRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// =============================================================================
// Public routes — no jwtAuth
// =============================================================================

/**
 * GET /v1/payment-links/config
 * Public — returns the platform fee config for the active network so UIs can
 * render the breakdown panel. `feeBps === 0` means no fee is charged and UIs
 * should hide all fee-disclosure strings.
 */
paymentLinksRouter.get('/config', async c => {
  const network = c.get('networkConfig').network;
  const { feeBps } = getPlatformFeeConfig(c.env);
  return success(c, { feeBps, network });
});

/**
 * GET /v1/payment-links/public/:id
 * Public — safe subset of the link metadata for the payer page.
 */
paymentLinksRouter.get('/public/:id', zValidator('param', idParamSchema), async c => {
  const db = createDb(c.env.DB);
  const { id } = c.req.valid('param');

  const rows = await db.select().from(paymentLinks).where(eq(paymentLinks.id, id)).limit(1);
  if (rows.length === 0) {
    throw new NotFoundError('Payment link not found');
  }
  let link = rows[0];

  // Count payments (needed before expiry check to pick the right terminal state).
  const payments = await db
    .select()
    .from(paymentLinkPayments)
    .where(eq(paymentLinkPayments.linkId, id))
    .orderBy(desc(paymentLinkPayments.paidAt));

  const paymentCount = payments.length;
  const lastPayment = payments[0] ?? null;

  // Auto-transition on read: if past expiry, terminal state depends on
  // whether the link ever received a payment. Links with payments are
  // "completed" (they generated revenue); links without are "expired".
  if (link.status === 'active' && link.expiresAt && link.expiresAt.getTime() < Date.now()) {
    const newStatus = paymentCount > 0 ? 'completed' : 'expired';
    await db.update(paymentLinks).set({ status: newStatus }).where(eq(paymentLinks.id, id));
    link = { ...link, status: newStatus };
  }

  const fulfilled = link.status !== 'active';

  const { feeBps } = getPlatformFeeConfig(c.env);

  return success(c, {
    id: link.id,
    network: link.network,
    recipient: link.recipient,
    token: link.token,
    tokenSymbol: link.tokenSymbol,
    tokenDecimals: link.tokenDecimals,
    amount: link.amount,
    amountDecimal: link.amountDecimal,
    title: link.title,
    description: link.description,
    reusable: link.reusable,
    status: link.status,
    expiresAt: link.expiresAt,
    createdAt: link.createdAt,
    fulfilled,
    paymentCount,
    lastPayment: lastPayment
      ? {
          payer: lastPayment.payer,
          txHash: lastPayment.txHash,
          paidAt: lastPayment.paidAt,
        }
      : null,
    feeBps,
  });
});

/**
 * POST /v1/payment-links/public/:id/pay
 * Public, mppx-gated. Returns 402 with a payment challenge until the payer
 * submits a signed credential, at which point we record the payment and
 * return 200 + Payment-Receipt header.
 */
paymentLinksRouter.post('/public/:id/pay', zValidator('param', idParamSchema), async c => {
  const db = createDb(c.env.DB);
  const { id } = c.req.valid('param');

  const rows = await db.select().from(paymentLinks).where(eq(paymentLinks.id, id)).limit(1);
  if (rows.length === 0) {
    throw new NotFoundError('Payment link not found');
  }
  const link = rows[0] as PaymentLink;

  // --- Fulfillment checks -------------------------------------------------
  if (link.status !== 'active') {
    throw new BadRequestError(`Payment link is ${link.status}`);
  }
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
    // Pick terminal state based on payment history — same rule as the
    // read-path transition: payments → completed, no payments → expired.
    const priorPayments = await db
      .select({ count: sql<number>`count(*)` })
      .from(paymentLinkPayments)
      .where(eq(paymentLinkPayments.linkId, id));
    const newStatus = (priorPayments[0]?.count ?? 0) > 0 ? 'completed' : 'expired';
    await db.update(paymentLinks).set({ status: newStatus }).where(eq(paymentLinks.id, id));
    throw new BadRequestError('Payment link has expired');
  }
  if (!link.reusable) {
    const existing = await db
      .select({ count: sql<number>`count(*)` })
      .from(paymentLinkPayments)
      .where(eq(paymentLinkPayments.linkId, id));
    if ((existing[0]?.count ?? 0) >= 1) {
      throw new BadRequestError('Payment link has already been paid');
    }
  }

  // --- Fee config ---------------------------------------------------------
  const { feeBps, treasury } = getPlatformFeeConfig(c.env);
  if (feeBps > 0 && !treasury) {
    throw new InternalError('Platform fee is configured but no treasury address is set');
  }

  // Compute fee in base units; mppx expects decimal-string amounts.
  const grossRaw = BigInt(link.amount);
  const feeAmountRaw = computeFeeAmount(grossRaw, feeBps);
  const feeAmountDecimal = feeAmountRaw > 0n ? formatUnits(feeAmountRaw, link.tokenDecimals) : '0';

  // --- Build charge options ----------------------------------------------
  // We intentionally do NOT pass `description` to mppx. Challenge.serialize
  // drops the raw description into the WWW-Authenticate header without
  // escaping quotes — if the creator's title contained a `"` the parser on
  // the client throws "Unterminated quoted-string" and the payment fails.
  // The title/description are already rendered on the public page from the
  // `GET /public/:id` response, so nothing is lost by omitting them here.
  const chargeOpts: {
    amount: string;
    recipient: Address;
    externalId?: string;
    splits?: { amount: string; recipient: Address; memo?: string }[];
  } = {
    amount: link.amountDecimal,
    recipient: link.recipient as Address,
    externalId: link.id,
  };

  if (feeAmountRaw > 0n && treasury) {
    chargeOpts.splits = [
      {
        amount: feeAmountDecimal,
        recipient: treasury as Address,
      },
    ];
  }

  // --- Invoke mppx -------------------------------------------------------
  const mppx = createMppxForLink(link, c.env);
  const result = await mppx.charge(chargeOpts)(c.req.raw);

  // 402: return mppx's challenge Response verbatim. It carries the
  // `WWW-Authenticate: Payment …` header, problem-details body, and the
  // cache directives mppx wants. CORS middleware running on the way out
  // will layer Access-Control-* headers on top.
  if (result.status === 402) {
    return result.challenge;
  }

  // 200: mppx's `withReceipt()` attaches a `Payment-Receipt` header to
  // whatever Response we hand it. We ask mppx to wrap an empty probe
  // first so we can decode the receipt — the only bit of persistent
  // metadata we care about is the on-chain tx hash (`reference`).
  const probe = result.withReceipt(new Response(null));
  const receiptHeader = probe.headers.get('Payment-Receipt') ?? '';
  let txHash = '';
  try {
    if (receiptHeader) {
      const decoded = Receipt.deserialize(receiptHeader);
      if (decoded.method === 'tempo' && typeof decoded.reference === 'string') {
        txHash = decoded.reference;
      }
    }
  } catch {
    // Don't block a successful charge on a malformed receipt — we'll
    // still record the row, just without a hash reference.
  }

  const netAmountRaw = grossRaw - feeAmountRaw;

  // We don't try to extract the payer address server-side — mppx doesn't
  // surface it on the result and we don't want to add a speculative
  // getTransaction RPC round-trip per pay call. The on-chain tx has the
  // sender; UI can derive it from the explorer link on demand.
  const inserted = await db
    .insert(paymentLinkPayments)
    .values({
      linkId: link.id,
      payer: '',
      txHash: txHash || '',
      amount: link.amount,
      feeAmount: feeAmountRaw.toString(),
      feeBps,
      netAmount: netAmountRaw.toString(),
    })
    .returning();

  // Single-use links are completed after the first payment.
  let linkStatus: string = link.status;
  if (!link.reusable) {
    await db.update(paymentLinks).set({ status: 'completed' }).where(eq(paymentLinks.id, link.id));
    linkStatus = 'completed';
  }

  const body = JSON.stringify({
    success: true,
    data: {
      link: {
        id: link.id,
        status: linkStatus,
        reusable: link.reusable,
      },
      payment: inserted[0],
    },
  });

  return result.withReceipt(
    new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );
});

// =============================================================================
// Authenticated routes
// =============================================================================

/** GET /v1/payment-links — list current user's links, filtered by active network. */
paymentLinksRouter.get('/', jwtAuth, zValidator('query', paymentLinkQuerySchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const network = c.get('networkConfig').network;
  const { status, cursor, limit } = c.req.valid('query');

  const conditions = [eq(paymentLinks.owner, owner), eq(paymentLinks.network, network)];
  if (status) conditions.push(eq(paymentLinks.status, status));

  if (cursor) {
    try {
      const decoded = atob(cursor);
      const sepIdx = decoded.indexOf(':');
      const cursorTs = parseInt(decoded.slice(0, sepIdx), 10);
      const cursorId = decoded.slice(sepIdx + 1);
      conditions.push(
        or(
          lt(paymentLinks.createdAt, new Date(cursorTs)),
          and(eq(paymentLinks.createdAt, new Date(cursorTs)), lt(paymentLinks.id, cursorId))
        )!
      );
    } catch {
      throw new BadRequestError('Invalid cursor');
    }
  }

  const rows = await db
    .select()
    .from(paymentLinks)
    .where(and(...conditions))
    .orderBy(desc(paymentLinks.createdAt), desc(paymentLinks.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  // Augment each row with a payment count in a single aggregation query.
  const ids = page.map(r => r.id);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const countRows = await db
      .select({
        linkId: paymentLinkPayments.linkId,
        count: sql<number>`count(*)`.as('count'),
      })
      .from(paymentLinkPayments)
      .where(or(...ids.map(pid => eq(paymentLinkPayments.linkId, pid)))!)
      .groupBy(paymentLinkPayments.linkId);
    for (const cr of countRows) counts.set(cr.linkId, Number(cr.count));
  }

  const items = page.map(r => ({
    ...r,
    paymentCount: counts.get(r.id) ?? 0,
  }));

  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const last = items[items.length - 1];
    const ts = last.createdAt instanceof Date ? last.createdAt.getTime() : 0;
    nextCursor = btoa(`${ts}:${last.id}`);
  }

  return paginated(c, items, nextCursor);
});

/** POST /v1/payment-links — create a new link owned by the current user. */
paymentLinksRouter.post('/', jwtAuth, zValidator('json', createPaymentLinkSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const network = c.get('networkConfig').network;
  const { token, amount, recipient, title, description, reusable, expiresAt } = c.req.valid('json');

  // Resolve token via tokenlist; rejects anything not in the allowlist.
  const resolved = await resolveAllowedToken(token, network);

  // Parse decimal amount → raw base units for on-chain math.
  let amountRaw: bigint;
  try {
    amountRaw = parseUnits(amount, resolved.decimals);
  } catch {
    throw new BadRequestError('Invalid amount for token decimals');
  }
  if (amountRaw <= 0n) {
    throw new BadRequestError('Amount must be greater than zero');
  }

  const inserted = await db
    .insert(paymentLinks)
    .values({
      owner,
      recipient,
      network,
      token: resolved.address,
      tokenSymbol: resolved.symbol,
      tokenDecimals: resolved.decimals,
      amount: amountRaw.toString(),
      amountDecimal: amount,
      title,
      description: description ?? null,
      reusable: reusable ?? false,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    })
    .returning();

  return success(c, inserted[0], 201);
});

/** GET /v1/payment-links/:id — single link with full payment history. */
paymentLinksRouter.get('/:id', jwtAuth, zValidator('param', idParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { id } = c.req.valid('param');

  const rows = await db
    .select()
    .from(paymentLinks)
    .where(and(eq(paymentLinks.id, id), eq(paymentLinks.owner, owner)))
    .limit(1);
  if (rows.length === 0) {
    throw new NotFoundError('Payment link not found');
  }

  const payments = await db
    .select()
    .from(paymentLinkPayments)
    .where(eq(paymentLinkPayments.linkId, id))
    .orderBy(desc(paymentLinkPayments.paidAt));

  return success(c, { ...rows[0], payments });
});

/**
 * DELETE /v1/payment-links/:id — stop or cancel an active link.
 *
 * - No payments recorded → cancelled (link was never used, safe to void).
 * - Has payments (reusable) → completed (stop accepting new payments).
 */
paymentLinksRouter.delete('/:id', jwtAuth, zValidator('param', idParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { id } = c.req.valid('param');

  const rows = await db
    .select()
    .from(paymentLinks)
    .where(and(eq(paymentLinks.id, id), eq(paymentLinks.owner, owner)))
    .limit(1);
  if (rows.length === 0) {
    throw new NotFoundError('Payment link not found');
  }
  if (rows[0].status !== 'active') {
    throw new BadRequestError(`Cannot stop link with status '${rows[0].status}'`);
  }

  const paymentCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(paymentLinkPayments)
    .where(eq(paymentLinkPayments.linkId, id));
  const hasPaid = (paymentCount[0]?.count ?? 0) >= 1;

  // Links with payments are "completed" (stopped); unpaid links are "cancelled" (voided).
  const newStatus = hasPaid ? 'completed' : 'cancelled';
  await db.update(paymentLinks).set({ status: newStatus }).where(eq(paymentLinks.id, id));

  return noContent(c);
});

export default paymentLinksRouter;
