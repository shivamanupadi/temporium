import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc, lt, or } from 'drizzle-orm';
import { jwtAuth, getWalletAddress } from '../middleware/auth';
import { NotFoundError, BadRequestError } from '../middleware/error';
import { createDb, recurringTransactions, recurringExecutions, accessKeys } from '../db';
import {
  createRecurringTxSchema,
  updateRecurringTxSchema,
  recurringTxQuerySchema,
  idParamSchema,
} from '../lib/validation';
import { success, paginated, noContent } from '../lib/response';
import { encryptAccessKey } from '../lib/key-vault';
import type { Env, Variables } from '../types/env';

const recurringRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

recurringRouter.use('*', jwtAuth);

/**
 * POST /v1/recurring-transactions
 * Create a recurring transaction. The user must have already authorized
 * the access key on-chain with appropriate spending limits + allowed-call
 * scopes; this endpoint takes over the runtime side (encrypts the private
 * key, schedules the DO).
 */
recurringRouter.post('/', zValidator('json', createRecurringTxSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const network = c.get('networkConfig').network;
  const data = c.req.valid('json');

  // Verify the access key belongs to this user
  const ak = await db
    .select()
    .from(accessKeys)
    .where(and(eq(accessKeys.id, data.accessKeyDbId), eq(accessKeys.owner, owner)))
    .limit(1);
  if (ak.length === 0) {
    throw new NotFoundError('Access key not found for this user');
  }
  if (ak[0].keyId.toLowerCase() !== data.accessKeyId.toLowerCase()) {
    throw new BadRequestError('accessKeyId does not match accessKeyDbId');
  }
  if (ak[0].signatureType !== data.accessKeySignatureType) {
    throw new BadRequestError('Signature type mismatch with stored access key');
  }

  const startAt = new Date(data.startAt);
  const endAt = data.endAt ? new Date(data.endAt) : null;
  const now = new Date();
  if (startAt.getTime() < now.getTime() - 60_000) {
    throw new BadRequestError('startAt must not be in the past');
  }
  if (endAt && endAt.getTime() <= startAt.getTime()) {
    throw new BadRequestError('endAt must be after startAt');
  }

  // Encrypt the access-key private key. After this point, the plaintext
  // privateKey is no longer referenced from this scope.
  const encryptedKey = await encryptAccessKey(data.accessKeyPrivateKey, c.env);

  const inserted = await db
    .insert(recurringTransactions)
    .values({
      owner,
      accessKeyDbId: data.accessKeyDbId,
      accessKeyId: data.accessKeyId,
      accessKeySignatureType: data.accessKeySignatureType,
      network,
      to: data.to,
      token: data.token,
      tokenSymbol: data.tokenSymbol,
      tokenDecimals: data.tokenDecimals,
      amount: data.amount,
      feeToken: data.feeToken,
      memo: data.memo,
      intervalSeconds: data.intervalSeconds,
      startAt,
      endAt,
      maxExecutions: data.maxExecutions,
      nextRunAt: startAt,
      status: 'active',
      label: data.label,
      notes: data.notes,
    })
    .returning();
  const row = inserted[0];

  // Boot the DO with the encrypted key and schedule.
  const doId = c.env.RECURRING_TX.idFromName(row.id);
  const doStub = c.env.RECURRING_TX.get(doId);
  await doStub.fetch(
    new Request('http://do/init', {
      method: 'POST',
      body: JSON.stringify({
        recurringId: row.id,
        encryptedKey,
        signatureType: data.accessKeySignatureType,
        owner,
        to: data.to,
        token: data.token,
        amount: data.amount,
        feeToken: data.feeToken,
        network,
        intervalSeconds: data.intervalSeconds,
        startAt: startAt.getTime(),
        endAt: endAt?.getTime(),
        maxExecutions: data.maxExecutions,
        memo: data.memo,
      }),
    })
  );

  return success(c, row, 201);
});

/**
 * GET /v1/recurring-transactions — list with cursor pagination
 */
recurringRouter.get('/', zValidator('query', recurringTxQuerySchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { status, cursor, limit } = c.req.valid('query');

  const conditions = [eq(recurringTransactions.owner, owner)];
  if (status) conditions.push(eq(recurringTransactions.status, status));

  if (cursor) {
    try {
      const decoded = atob(cursor);
      const sepIdx = decoded.indexOf(':');
      const ts = parseInt(decoded.slice(0, sepIdx), 10);
      const id = decoded.slice(sepIdx + 1);
      conditions.push(
        or(
          lt(recurringTransactions.createdAt, new Date(ts)),
          and(
            eq(recurringTransactions.createdAt, new Date(ts)),
            lt(recurringTransactions.id, id)
          )
        )!
      );
    } catch {
      throw new BadRequestError('Invalid cursor');
    }
  }

  const result = await db
    .select()
    .from(recurringTransactions)
    .where(and(...conditions))
    .orderBy(desc(recurringTransactions.createdAt), desc(recurringTransactions.id))
    .limit(limit + 1);

  const hasMore = result.length > limit;
  const items = hasMore ? result.slice(0, limit) : result;
  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const last = items[items.length - 1];
    const ts = last.createdAt instanceof Date ? last.createdAt.getTime() : 0;
    nextCursor = btoa(`${ts}:${last.id}`);
  }
  return paginated(c, items, nextCursor);
});

/**
 * GET /v1/recurring-transactions/:id
 */
recurringRouter.get('/:id', zValidator('param', idParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { id } = c.req.valid('param');

  const result = await db
    .select()
    .from(recurringTransactions)
    .where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.owner, owner)))
    .limit(1);
  if (result.length === 0) throw new NotFoundError('Recurring transaction not found');
  return success(c, result[0]);
});

/**
 * GET /v1/recurring-transactions/:id/executions
 */
recurringRouter.get('/:id/executions', zValidator('param', idParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { id } = c.req.valid('param');

  const parent = await db
    .select()
    .from(recurringTransactions)
    .where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.owner, owner)))
    .limit(1);
  if (parent.length === 0) throw new NotFoundError('Recurring transaction not found');

  const items = await db
    .select()
    .from(recurringExecutions)
    .where(eq(recurringExecutions.recurringId, id))
    .orderBy(desc(recurringExecutions.runNumber))
    .limit(100);
  return success(c, items);
});

/**
 * PATCH /v1/recurring-transactions/:id — label/notes/status
 * Status transitions: active ↔ paused, anything → cancelled.
 */
recurringRouter.patch(
  '/:id',
  zValidator('param', idParamSchema),
  zValidator('json', updateRecurringTxSchema),
  async c => {
    const db = createDb(c.env.DB);
    const owner = getWalletAddress(c);
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');

    const existing = await db
      .select()
      .from(recurringTransactions)
      .where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.owner, owner)))
      .limit(1);
    if (existing.length === 0) throw new NotFoundError('Recurring transaction not found');
    const row = existing[0];

    const updates: Partial<typeof recurringTransactions.$inferInsert> = {};
    if (data.label !== undefined) updates.label = data.label;
    if (data.notes !== undefined) updates.notes = data.notes;
    if (data.status) {
      if (row.status === 'completed' || row.status === 'failed' || row.status === 'cancelled') {
        throw new BadRequestError(`Cannot change status of '${row.status}' recurring`);
      }
      if (data.status === 'active' && row.status !== 'paused') {
        throw new BadRequestError(`Invalid status transition: ${row.status} → active`);
      }
      if (data.status === 'paused' && row.status !== 'active') {
        throw new BadRequestError(`Invalid status transition: ${row.status} → paused`);
      }
      updates.status = data.status;
    }

    const result = await db
      .update(recurringTransactions)
      .set(updates)
      .where(eq(recurringTransactions.id, id))
      .returning();

    if (data.status) {
      const doId = c.env.RECURRING_TX.idFromName(id);
      const doStub = c.env.RECURRING_TX.get(doId);
      const path =
        data.status === 'paused'
          ? '/pause'
          : data.status === 'cancelled'
            ? '/cancel'
            : '/resume';
      try {
        await doStub.fetch(new Request(`http://do${path}`, { method: 'POST' }));
      } catch {
        // DO may not exist if already terminal
      }
    }

    return success(c, result[0]);
  }
);

/**
 * DELETE /v1/recurring-transactions/:id — cancel and remove DO state.
 * Keeps the row (status='cancelled') for history; use force=true to hard-delete.
 */
recurringRouter.delete('/:id', zValidator('param', idParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { id } = c.req.valid('param');
  const force = c.req.query('force') === 'true';

  const existing = await db
    .select()
    .from(recurringTransactions)
    .where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.owner, owner)))
    .limit(1);
  if (existing.length === 0) throw new NotFoundError('Recurring transaction not found');

  try {
    const doId = c.env.RECURRING_TX.idFromName(id);
    const doStub = c.env.RECURRING_TX.get(doId);
    await doStub.fetch(new Request('http://do/cancel', { method: 'POST' }));
  } catch {
    // ignore
  }

  if (force) {
    await db.delete(recurringExecutions).where(eq(recurringExecutions.recurringId, id));
    await db.delete(recurringTransactions).where(eq(recurringTransactions.id, id));
  } else {
    await db
      .update(recurringTransactions)
      .set({ status: 'cancelled' })
      .where(eq(recurringTransactions.id, id));
  }

  return noContent(c);
});

export default recurringRouter;
