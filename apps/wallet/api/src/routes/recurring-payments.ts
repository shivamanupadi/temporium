import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc, lt, or } from 'drizzle-orm';
import { jwtAuth, getWalletAddress } from '../middleware/auth';
import { NotFoundError, BadRequestError } from '../middleware/error';
import { createDb, recurringPayments, recurringPaymentExecutions } from '../db';
import {
  createRecurringPaymentSchema,
  recurringPaymentQuerySchema,
  recurringPaymentStatusParamSchema,
  idParamSchema,
} from '../lib/validation';
import { success, paginated, noContent } from '../lib/response';
import type { Env, Variables } from '../types/env';

const recurringPaymentsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// All routes require authentication
recurringPaymentsRouter.use('/*', jwtAuth);

/**
 * GET /v1/recurring-payments
 * List recurring payments with cursor-based pagination and optional status filter
 */
recurringPaymentsRouter.get('/', zValidator('query', recurringPaymentQuerySchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { status, network, cursor, limit } = c.req.valid('query');

  const conditions = [eq(recurringPayments.owner, owner)];

  if (status) {
    conditions.push(eq(recurringPayments.status, status));
  }

  if (network) {
    conditions.push(eq(recurringPayments.network, network));
  }

  if (cursor) {
    try {
      const decoded = atob(cursor);
      const sepIdx = decoded.indexOf(':');
      const cursorTs = parseInt(decoded.slice(0, sepIdx), 10);
      const cursorId = decoded.slice(sepIdx + 1);
      conditions.push(
        or(
          lt(recurringPayments.createdAt, new Date(cursorTs)),
          and(
            eq(recurringPayments.createdAt, new Date(cursorTs)),
            lt(recurringPayments.id, cursorId)
          )
        )!
      );
    } catch {
      throw new BadRequestError('Invalid cursor');
    }
  }

  const result = await db
    .select()
    .from(recurringPayments)
    .where(and(...conditions))
    .orderBy(desc(recurringPayments.createdAt), desc(recurringPayments.id))
    .limit(limit + 1);

  const hasMore = result.length > limit;
  const data = hasMore ? result.slice(0, limit) : result;

  let nextCursor: string | null = null;
  if (hasMore && data.length > 0) {
    const last = data[data.length - 1];
    const ts = last.createdAt instanceof Date ? last.createdAt.getTime() : 0;
    nextCursor = btoa(`${ts}:${last.id}`);
  }

  return paginated(c, data, nextCursor);
});

/**
 * GET /v1/recurring-payments/status/:status
 * List recurring payments by status
 */
recurringPaymentsRouter.get(
  '/status/:status',
  zValidator('param', recurringPaymentStatusParamSchema),
  async c => {
    const db = createDb(c.env.DB);
    const owner = getWalletAddress(c);
    const network = c.get('networkConfig').network;
    const { status } = c.req.valid('param');

    const result = await db
      .select()
      .from(recurringPayments)
      .where(
        and(
          eq(recurringPayments.owner, owner),
          eq(recurringPayments.status, status),
          eq(recurringPayments.network, network)
        )
      )
      .orderBy(desc(recurringPayments.createdAt));

    return success(c, result);
  }
);

/**
 * GET /v1/recurring-payments/:id
 * Get a specific recurring payment
 */
recurringPaymentsRouter.get('/:id', zValidator('param', idParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { id } = c.req.valid('param');

  const result = await db
    .select()
    .from(recurringPayments)
    .where(and(eq(recurringPayments.id, id), eq(recurringPayments.owner, owner)))
    .limit(1);

  if (result.length === 0) {
    throw new NotFoundError('Recurring payment not found');
  }

  return success(c, result[0]);
});

/**
 * POST /v1/recurring-payments
 * Create a new recurring payment record.
 * Called after the on-chain subscription is created via the RecurringPayments contract.
 */
recurringPaymentsRouter.post('/', zValidator('json', createRecurringPaymentSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const data = c.req.valid('json');
  const network = c.get('networkConfig').network;

  const nextPaymentAt = new Date(data.nextPaymentAt);

  // 1. Save to D1
  const result = await db
    .insert(recurringPayments)
    .values({
      owner,
      recipient: data.recipient,
      token: data.token,
      tokenSymbol: data.tokenSymbol,
      tokenDecimals: data.tokenDecimals,
      amount: data.amount,
      intervalSeconds: data.intervalSeconds,
      maxPayments: data.maxPayments ?? 0,
      subscriptionId: data.subscriptionId,
      contractAddress: data.contractAddress,
      network,
      nextPaymentAt,
      txHash: data.txHash,
      label: data.label,
    })
    .returning();

  const record = result[0];

  // 2. Create a Durable Object to handle execution at each interval
  const doId = c.env.RECURRING_PAYMENT.idFromName(record.id);
  const doStub = c.env.RECURRING_PAYMENT.get(doId);

  await doStub.fetch(
    new Request('http://do/schedule', {
      method: 'POST',
      body: JSON.stringify({
        recordId: record.id,
        subscriptionId: data.subscriptionId,
        contractAddress: data.contractAddress,
        network,
        intervalMs: data.intervalSeconds * 1000,
        nextPaymentAt: nextPaymentAt.getTime(),
      }),
    })
  );

  return success(c, record, 201);
});

/**
 * GET /v1/recurring-payments/:id/executions
 * List all payment executions for a recurring payment
 */
recurringPaymentsRouter.get('/:id/executions', zValidator('param', idParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { id } = c.req.valid('param');

  // Verify ownership
  const existing = await db
    .select()
    .from(recurringPayments)
    .where(and(eq(recurringPayments.id, id), eq(recurringPayments.owner, owner)))
    .limit(1);

  if (existing.length === 0) {
    throw new NotFoundError('Recurring payment not found');
  }

  const executions = await db
    .select()
    .from(recurringPaymentExecutions)
    .where(eq(recurringPaymentExecutions.recurringPaymentId, id))
    .orderBy(desc(recurringPaymentExecutions.executedAt));

  return success(c, executions);
});

/**
 * DELETE /v1/recurring-payments/:id
 * Cancel a recurring payment. User must also cancel the on-chain subscription.
 */
recurringPaymentsRouter.delete('/:id', zValidator('param', idParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { id } = c.req.valid('param');

  const existing = await db
    .select()
    .from(recurringPayments)
    .where(and(eq(recurringPayments.id, id), eq(recurringPayments.owner, owner)))
    .limit(1);

  if (existing.length === 0) {
    throw new NotFoundError('Recurring payment not found');
  }

  if (existing[0].status !== 'active') {
    throw new BadRequestError(
      `Cannot cancel recurring payment with status '${existing[0].status}'`
    );
  }

  // Cancel the DO alarm
  try {
    const doId = c.env.RECURRING_PAYMENT.idFromName(id);
    const doStub = c.env.RECURRING_PAYMENT.get(doId);
    await doStub.fetch(new Request('http://do/cancel', { method: 'POST' }));
  } catch {
    // DO may not exist — that's fine
  }

  // Mark as cancelled (keep the record for history)
  await db
    .update(recurringPayments)
    .set({ status: 'cancelled' })
    .where(eq(recurringPayments.id, id));

  return noContent(c);
});

export default recurringPaymentsRouter;
