import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc } from 'drizzle-orm';
import { jwtAuth, getWalletAddress } from '../middleware/auth';
import { NotFoundError, ConflictError } from '../middleware/error';
import { createDb, customTokens } from '../db';
import { createCustomTokenSchema, idParamSchema } from '../lib/validation';
import { success, noContent } from '../lib/response';
import type { Env, Variables } from '../types/env';

const customTokensRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// All routes require authentication
customTokensRouter.use('/*', jwtAuth);

/**
 * GET /v1/custom-tokens
 * List all custom tokens for the authenticated user
 */
customTokensRouter.get('/', async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);

  const result = await db
    .select()
    .from(customTokens)
    .where(eq(customTokens.owner, owner))
    .orderBy(desc(customTokens.createdAt));

  return success(c, result);
});

/**
 * POST /v1/custom-tokens
 * Add a custom token
 */
customTokensRouter.post('/', zValidator('json', createCustomTokenSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { address, name, symbol, decimals, logoURI } = c.req.valid('json');

  // Check if token already exists for this user
  const existing = await db
    .select()
    .from(customTokens)
    .where(and(eq(customTokens.owner, owner), eq(customTokens.address, address)))
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError('Custom token with this address already exists');
  }

  const result = await db
    .insert(customTokens)
    .values({
      owner,
      address,
      name,
      symbol,
      decimals,
      logoURI: logoURI || null,
    })
    .returning();

  return success(c, result[0], 201);
});

/**
 * DELETE /v1/custom-tokens/:id
 * Remove a custom token
 */
customTokensRouter.delete('/:id', zValidator('param', idParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { id } = c.req.valid('param');

  const existing = await db
    .select()
    .from(customTokens)
    .where(and(eq(customTokens.id, id), eq(customTokens.owner, owner)))
    .limit(1);

  if (existing.length === 0) {
    throw new NotFoundError('Custom token not found');
  }

  await db.delete(customTokens).where(eq(customTokens.id, id));

  return noContent(c);
});

export default customTokensRouter;
