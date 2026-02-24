import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc } from 'drizzle-orm';
import { jwtAuth, getWalletAddress } from '../middleware/auth';
import { NotFoundError, ConflictError } from '../middleware/error';
import { createDb, watchedSpenders } from '../db';
import { createWatchedSpenderSchema, idParamSchema } from '../lib/validation';
import { success, noContent } from '../lib/response';
import type { Env, Variables } from '../types/env';

const watchedSpendersRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// All routes require authentication
watchedSpendersRouter.use('/*', jwtAuth);

/**
 * GET /v1/watched-spenders
 * List all watched spenders for the authenticated user
 */
watchedSpendersRouter.get('/', async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);

  const result = await db
    .select()
    .from(watchedSpenders)
    .where(eq(watchedSpenders.owner, owner))
    .orderBy(desc(watchedSpenders.createdAt));

  return success(c, result);
});

/**
 * POST /v1/watched-spenders
 * Add a watched spender
 */
watchedSpendersRouter.post('/', zValidator('json', createWatchedSpenderSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { address, label } = c.req.valid('json');

  // Check if spender already exists for this user
  const existing = await db
    .select()
    .from(watchedSpenders)
    .where(and(eq(watchedSpenders.owner, owner), eq(watchedSpenders.address, address)))
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError('Watched spender with this address already exists');
  }

  const result = await db
    .insert(watchedSpenders)
    .values({
      owner,
      address,
      label: label || null,
    })
    .returning();

  return success(c, result[0], 201);
});

/**
 * DELETE /v1/watched-spenders/:id
 * Remove a watched spender
 */
watchedSpendersRouter.delete('/:id', zValidator('param', idParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { id } = c.req.valid('param');

  const existing = await db
    .select()
    .from(watchedSpenders)
    .where(and(eq(watchedSpenders.id, id), eq(watchedSpenders.owner, owner)))
    .limit(1);

  if (existing.length === 0) {
    throw new NotFoundError('Watched spender not found');
  }

  await db.delete(watchedSpenders).where(eq(watchedSpenders.id, id));

  return noContent(c);
});

export default watchedSpendersRouter;
