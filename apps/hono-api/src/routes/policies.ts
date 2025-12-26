import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc } from 'drizzle-orm';
import { jwtAuth, getWalletAddress } from '../middleware/auth';
import { NotFoundError, ConflictError } from '../middleware/error';
import { createDb, policies } from '../db';
import {
  createPolicySchema,
  idParamSchema,
  policyTypeParamSchema,
  policyIdParamSchema,
} from '../lib/validation';
import { success, noContent } from '../lib/response';
import type { Env, Variables } from '../types/env';

const policiesRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// All routes require authentication
policiesRouter.use('/*', jwtAuth);

/**
 * GET /v1/policies
 * List all policies for the authenticated user
 */
policiesRouter.get('/', async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);

  const result = await db
    .select()
    .from(policies)
    .where(eq(policies.owner, owner))
    .orderBy(desc(policies.createdAt));

  return success(c, result);
});

/**
 * GET /v1/policies/type/:type
 * List policies by type (whitelist/blacklist)
 */
policiesRouter.get('/type/:type', zValidator('param', policyTypeParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { type } = c.req.valid('param');

  const result = await db
    .select()
    .from(policies)
    .where(and(eq(policies.owner, owner), eq(policies.type, type)))
    .orderBy(desc(policies.createdAt));

  return success(c, result);
});

/**
 * GET /v1/policies/:id
 * Get a specific policy
 */
policiesRouter.get('/:id', zValidator('param', idParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { id } = c.req.valid('param');

  const result = await db
    .select()
    .from(policies)
    .where(and(eq(policies.id, id), eq(policies.owner, owner)))
    .limit(1);

  if (result.length === 0) {
    throw new NotFoundError('Policy not found');
  }

  return success(c, result[0]);
});

/**
 * GET /v1/policies/by-policy-id/:policyId
 * Get a policy by its on-chain policy ID
 */
policiesRouter.get('/by-policy-id/:policyId', zValidator('param', policyIdParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { policyId } = c.req.valid('param');

  const result = await db
    .select()
    .from(policies)
    .where(and(eq(policies.owner, owner), eq(policies.policyId, policyId)))
    .limit(1);

  if (result.length === 0) {
    throw new NotFoundError('Policy not found');
  }

  return success(c, result[0]);
});

/**
 * POST /v1/policies
 * Create a new policy record
 */
policiesRouter.post('/', zValidator('json', createPolicySchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const data = c.req.valid('json');

  // Check if policy already exists for this owner
  const existing = await db
    .select()
    .from(policies)
    .where(and(eq(policies.owner, owner), eq(policies.policyId, data.policyId)))
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError('Policy with this ID already exists');
  }

  const result = await db
    .insert(policies)
    .values({
      owner,
      policyId: data.policyId,
      type: data.type,
      admin: data.admin,
      txHash: data.txHash,
    })
    .returning();

  return success(c, result[0], 201);
});

/**
 * DELETE /v1/policies/:id
 * Delete a policy record
 */
policiesRouter.delete('/:id', zValidator('param', idParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { id } = c.req.valid('param');

  // Verify the policy exists and belongs to the user
  const existing = await db
    .select()
    .from(policies)
    .where(and(eq(policies.id, id), eq(policies.owner, owner)))
    .limit(1);

  if (existing.length === 0) {
    throw new NotFoundError('Policy not found');
  }

  await db.delete(policies).where(eq(policies.id, id));

  return noContent(c);
});

export default policiesRouter;
