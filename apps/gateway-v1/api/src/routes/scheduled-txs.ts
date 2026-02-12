import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, asc, desc, lt, or } from 'drizzle-orm';
import { jwtAuth, getWalletAddress } from '../middleware/auth';
import { NotFoundError, BadRequestError } from '../middleware/error';
import { createDb, scheduledTransactions } from '../db';
import {
  createScheduledTxSchema,
  updateScheduledTxSchema,
  scheduledTxQuerySchema,
  idParamSchema,
  statusParamSchema,
} from '../lib/validation';
import { success, paginated, noContent } from '../lib/response';
import type { Env, Variables } from '../types/env';

const scheduledTxsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// All routes require authentication
scheduledTxsRouter.use('/*', jwtAuth);

/**
 * GET /v1/scheduled-transactions
 * List scheduled transactions with cursor-based pagination and status filter
 *
 * Query params:
 *   status  - filter by status (pending | executed | failed)
 *   cursor  - opaque cursor from previous response (base64 of createdAt:id)
 *   limit   - page size (1-50, default 20)
 */
scheduledTxsRouter.get('/', zValidator('query', scheduledTxQuerySchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { status, cursor, limit } = c.req.valid('query');

  // Build WHERE conditions
  const conditions = [eq(scheduledTransactions.owner, owner)];

  if (status) {
    conditions.push(eq(scheduledTransactions.status, status));
  }

  // Decode cursor (base64 of "timestamp:id")
  if (cursor) {
    try {
      const decoded = atob(cursor);
      const sepIdx = decoded.indexOf(':');
      const cursorTs = parseInt(decoded.slice(0, sepIdx), 10);
      const cursorId = decoded.slice(sepIdx + 1);
      // createdAt DESC, id DESC — fetch rows older than cursor
      conditions.push(
        or(
          lt(scheduledTransactions.createdAt, new Date(cursorTs)),
          and(
            eq(scheduledTransactions.createdAt, new Date(cursorTs)),
            lt(scheduledTransactions.id, cursorId),
          ),
        )!,
      );
    } catch {
      throw new BadRequestError('Invalid cursor');
    }
  }

  // Fetch limit+1 to know if there's a next page
  const result = await db
    .select()
    .from(scheduledTransactions)
    .where(and(...conditions))
    .orderBy(desc(scheduledTransactions.createdAt), desc(scheduledTransactions.id))
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
 * GET /v1/scheduled-transactions/status/:status
 * List scheduled transactions by status
 */
scheduledTxsRouter.get('/status/:status', zValidator('param', statusParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { status } = c.req.valid('param');

  const result = await db
    .select()
    .from(scheduledTransactions)
    .where(and(eq(scheduledTransactions.owner, owner), eq(scheduledTransactions.status, status)))
    .orderBy(asc(scheduledTransactions.scheduledFor));

  return success(c, result);
});

/**
 * GET /v1/scheduled-transactions/pending
 * List pending scheduled transactions
 */
scheduledTxsRouter.get('/pending', async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);

  const result = await db
    .select()
    .from(scheduledTransactions)
    .where(and(eq(scheduledTransactions.owner, owner), eq(scheduledTransactions.status, 'pending')))
    .orderBy(asc(scheduledTransactions.scheduledFor));

  return success(c, result);
});

/**
 * GET /v1/scheduled-transactions/:id
 * Get a specific scheduled transaction
 */
scheduledTxsRouter.get('/:id', zValidator('param', idParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { id } = c.req.valid('param');

  const result = await db
    .select()
    .from(scheduledTransactions)
    .where(and(eq(scheduledTransactions.id, id), eq(scheduledTransactions.owner, owner)))
    .limit(1);

  if (result.length === 0) {
    throw new NotFoundError('Scheduled transaction not found');
  }

  return success(c, result[0]);
});

/**
 * POST /v1/scheduled-transactions
 * Create a new scheduled transaction
 */
scheduledTxsRouter.post('/', zValidator('json', createScheduledTxSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const data = c.req.valid('json');
  const network = c.get('networkConfig').network;

  // 1. Save metadata to D1 (for listing/UI)
  const result = await db
    .insert(scheduledTransactions)
    .values({
      owner,
      serializedTx: data.serializedTx,
      network,
      from: data.from,
      to: data.to,
      amount: data.amount,
      token: data.token,
      tokenSymbol: data.tokenSymbol,
      tokenDecimals: data.tokenDecimals,
      feeToken: data.feeToken,
      memo: data.memo,
      scheduledFor: new Date(data.scheduledFor),
    })
    .returning();

  const txRecord = result[0];

  // 2. Create a Durable Object to handle execution at the scheduled time
  const doId = c.env.SCHEDULED_TX.idFromName(txRecord.id);
  const doStub = c.env.SCHEDULED_TX.get(doId);

  await doStub.fetch(new Request('http://do/schedule', {
    method: 'POST',
    body: JSON.stringify({
      txId: txRecord.id,
      serializedTx: data.serializedTx,
      network,
      scheduledFor: new Date(data.scheduledFor).getTime(),
    }),
  }));

  return success(c, txRecord, 201);
});

/**
 * PATCH /v1/scheduled-transactions/:id
 * Update a scheduled transaction status
 */
scheduledTxsRouter.patch(
  '/:id',
  zValidator('param', idParamSchema),
  zValidator('json', updateScheduledTxSchema),
  async c => {
    const db = createDb(c.env.DB);
    const owner = getWalletAddress(c);
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');

    // Verify the transaction exists and belongs to the user
    const existing = await db
      .select()
      .from(scheduledTransactions)
      .where(and(eq(scheduledTransactions.id, id), eq(scheduledTransactions.owner, owner)))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundError('Scheduled transaction not found');
    }

    const updateData: Partial<typeof scheduledTransactions.$inferInsert> = {};
    if (data.status) {
      updateData.status = data.status;
    }
    if (data.executedAt) {
      updateData.executedAt = new Date(data.executedAt);
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestError('No valid fields to update');
    }

    const result = await db
      .update(scheduledTransactions)
      .set(updateData)
      .where(eq(scheduledTransactions.id, id))
      .returning();

    return success(c, result[0]);
  }
);

/**
 * POST /v1/scheduled-transactions/:id/execute
 * Mark a scheduled transaction as executed
 */
scheduledTxsRouter.post('/:id/execute', zValidator('param', idParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { id } = c.req.valid('param');

  // Verify the transaction exists and belongs to the user
  const existing = await db
    .select()
    .from(scheduledTransactions)
    .where(and(eq(scheduledTransactions.id, id), eq(scheduledTransactions.owner, owner)))
    .limit(1);

  if (existing.length === 0) {
    throw new NotFoundError('Scheduled transaction not found');
  }

  if (existing[0].status !== 'pending') {
    throw new BadRequestError(`Cannot execute transaction with status '${existing[0].status}'`);
  }

  const body = await c.req.json().catch(() => ({}));
  const result = await db
    .update(scheduledTransactions)
    .set({
      status: 'executed',
      txHash: body.txHash ?? null,
      executedAt: new Date(),
    })
    .where(eq(scheduledTransactions.id, id))
    .returning();

  return success(c, result[0]);
});

/**
 * POST /v1/scheduled-transactions/:id/fail
 * Mark a scheduled transaction as failed
 */
scheduledTxsRouter.post('/:id/fail', zValidator('param', idParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { id } = c.req.valid('param');

  // Verify the transaction exists and belongs to the user
  const existing = await db
    .select()
    .from(scheduledTransactions)
    .where(and(eq(scheduledTransactions.id, id), eq(scheduledTransactions.owner, owner)))
    .limit(1);

  if (existing.length === 0) {
    throw new NotFoundError('Scheduled transaction not found');
  }

  if (existing[0].status !== 'pending') {
    throw new BadRequestError(
      `Cannot mark transaction as failed with status '${existing[0].status}'`
    );
  }

  const body = await c.req.json().catch(() => ({}));
  const result = await db
    .update(scheduledTransactions)
    .set({
      status: 'failed',
      failReason: body.reason ?? 'Unknown error',
    })
    .where(eq(scheduledTransactions.id, id))
    .returning();

  return success(c, result[0]);
});

/**
 * DELETE /v1/scheduled-transactions/:id
 * Delete a scheduled transaction
 */
scheduledTxsRouter.delete('/:id', zValidator('param', idParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { id } = c.req.valid('param');

  // Verify the transaction exists and belongs to the user
  const existing = await db
    .select()
    .from(scheduledTransactions)
    .where(and(eq(scheduledTransactions.id, id), eq(scheduledTransactions.owner, owner)))
    .limit(1);

  if (existing.length === 0) {
    throw new NotFoundError('Scheduled transaction not found');
  }

  if (existing[0].status !== 'pending') {
    throw new BadRequestError(`Cannot cancel transaction with status '${existing[0].status}'`);
  }

  // Cancel the DO alarm before deleting
  try {
    const doId = c.env.SCHEDULED_TX.idFromName(id);
    const doStub = c.env.SCHEDULED_TX.get(doId);
    await doStub.fetch(new Request('http://do/cancel', { method: 'POST' }));
  } catch {
    // DO may not exist if it already fired — that's fine
  }

  await db.delete(scheduledTransactions).where(eq(scheduledTransactions.id, id));

  return noContent(c);
});

export default scheduledTxsRouter;
