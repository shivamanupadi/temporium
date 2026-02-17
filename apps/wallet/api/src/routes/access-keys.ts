import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc } from 'drizzle-orm';
import { jwtAuth, getWalletAddress } from '../middleware/auth';
import { NotFoundError, ConflictError } from '../middleware/error';
import { createDb, accessKeys } from '../db';
import { createAccessKeySchema, idParamSchema } from '../lib/validation';
import { success, noContent } from '../lib/response';
import type { Env, Variables } from '../types/env';

const accessKeysRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// All routes require authentication
accessKeysRouter.use('/*', jwtAuth);

/**
 * GET /v1/access-keys
 * List all access keys for the authenticated user
 */
accessKeysRouter.get('/', async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);

  const result = await db
    .select()
    .from(accessKeys)
    .where(eq(accessKeys.owner, owner))
    .orderBy(desc(accessKeys.createdAt));

  return success(c, result);
});

/**
 * POST /v1/access-keys
 * Save a new access key record after on-chain authorization
 */
accessKeysRouter.post('/', zValidator('json', createAccessKeySchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const data = c.req.valid('json');

  // Check if key already exists for this owner
  const existing = await db
    .select()
    .from(accessKeys)
    .where(and(eq(accessKeys.owner, owner), eq(accessKeys.keyId, data.keyId)))
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError('Access key already exists');
  }

  const result = await db
    .insert(accessKeys)
    .values({
      owner,
      keyId: data.keyId,
      signatureType: data.signatureType,
      txHash: data.txHash,
      label: data.label,
    })
    .returning();

  return success(c, result[0], 201);
});

/**
 * DELETE /v1/access-keys/:id
 * Delete an access key record
 */
accessKeysRouter.delete('/:id', zValidator('param', idParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { id } = c.req.valid('param');

  const existing = await db
    .select()
    .from(accessKeys)
    .where(and(eq(accessKeys.id, id), eq(accessKeys.owner, owner)))
    .limit(1);

  if (existing.length === 0) {
    throw new NotFoundError('Access key not found');
  }

  await db.delete(accessKeys).where(eq(accessKeys.id, id));

  return noContent(c);
});

export default accessKeysRouter;
