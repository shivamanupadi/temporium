import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc } from 'drizzle-orm';
import { jwtAuth, getWalletAddress } from '../middleware/auth';
import { NotFoundError, ConflictError } from '../middleware/error';
import { createDb, accessKeys } from '../db';
import {
  createAccessKeySchema,
  updateAccessKeySchema,
  touchAccessKeySchema,
  idParamSchema,
} from '../lib/validation';
import { success, noContent } from '../lib/response';
import type { Env, Variables } from '../types/env';

/**
 * Best-effort client IP from Cloudflare/Hono headers.
 */
function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string | null {
  return (
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    null
  );
}

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
      notes: data.notes,
    })
    .returning();

  return success(c, result[0], 201);
});

/**
 * PATCH /v1/access-keys/:id
 * Update mutable fields (label, notes) on an access key record.
 * On-chain state (expiry, scopes, limits) is unaffected.
 */
accessKeysRouter.patch(
  '/:id',
  zValidator('param', idParamSchema),
  zValidator('json', updateAccessKeySchema),
  async c => {
    const db = createDb(c.env.DB);
    const owner = getWalletAddress(c);
    const { id } = c.req.valid('param');
    const data = c.req.valid('json');

    const existing = await db
      .select()
      .from(accessKeys)
      .where(and(eq(accessKeys.id, id), eq(accessKeys.owner, owner)))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundError('Access key not found');
    }

    const result = await db
      .update(accessKeys)
      .set({
        ...(data.label !== undefined && { label: data.label || null }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
      })
      .where(eq(accessKeys.id, id))
      .returning();

    return success(c, result[0]);
  }
);

/**
 * POST /v1/access-keys/by-key/:keyId/touch
 * Stamp lastUsedAt / lastUsedIp / lastUsedNetwork. Called by SDK clients
 * (or our own middleware) on each successful signed call so the dashboard
 * can show "Last used 3h ago from 1.2.3.4 on mainnet".
 *
 * Identified by keyId rather than db id so SDK callers don't need the cuid.
 */
accessKeysRouter.post('/by-key/:keyId/touch', zValidator('json', touchAccessKeySchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const keyId = c.req.param('keyId').toLowerCase();
  const body = c.req.valid('json') ?? {};
  const ip = getClientIp(c);

  const existing = await db
    .select()
    .from(accessKeys)
    .where(and(eq(accessKeys.keyId, keyId), eq(accessKeys.owner, owner)))
    .limit(1);

  if (existing.length === 0) {
    throw new NotFoundError('Access key not found');
  }

  const result = await db
    .update(accessKeys)
    .set({
      lastUsedAt: new Date(),
      lastUsedIp: ip,
      lastUsedNetwork: body.network ?? null,
    })
    .where(eq(accessKeys.id, existing[0].id))
    .returning();

  return success(c, result[0]);
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
