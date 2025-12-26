import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc } from 'drizzle-orm';
import { jwtAuth, getWalletAddress } from '../middleware/auth';
import { NotFoundError, ConflictError } from '../middleware/error';
import { createDb, tip20Contracts } from '../db';
import { createTip20ContractSchema, idParamSchema, addressParamSchema } from '../lib/validation';
import { success, noContent } from '../lib/response';
import type { Env, Variables } from '../types/env';

const tip20Router = new Hono<{ Bindings: Env; Variables: Variables }>();

// All routes require authentication
tip20Router.use('/*', jwtAuth);

/**
 * GET /v1/tip20-contracts
 * List all TIP-20 contracts for the authenticated user
 */
tip20Router.get('/', async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);

  const result = await db
    .select()
    .from(tip20Contracts)
    .where(eq(tip20Contracts.owner, owner))
    .orderBy(desc(tip20Contracts.createdAt));

  return success(c, result);
});

/**
 * GET /v1/tip20-contracts/:id
 * Get a specific TIP-20 contract
 */
tip20Router.get('/:id', zValidator('param', idParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { id } = c.req.valid('param');

  const result = await db
    .select()
    .from(tip20Contracts)
    .where(and(eq(tip20Contracts.id, id), eq(tip20Contracts.owner, owner)))
    .limit(1);

  if (result.length === 0) {
    throw new NotFoundError('TIP-20 contract not found');
  }

  return success(c, result[0]);
});

/**
 * GET /v1/tip20-contracts/by-address/:address
 * Get a TIP-20 contract by its address
 */
tip20Router.get('/by-address/:address', zValidator('param', addressParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { address } = c.req.valid('param');

  const result = await db
    .select()
    .from(tip20Contracts)
    .where(and(eq(tip20Contracts.owner, owner), eq(tip20Contracts.address, address)))
    .limit(1);

  if (result.length === 0) {
    throw new NotFoundError('TIP-20 contract not found');
  }

  return success(c, result[0]);
});

/**
 * POST /v1/tip20-contracts
 * Create a new TIP-20 contract record
 */
tip20Router.post('/', zValidator('json', createTip20ContractSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const data = c.req.valid('json');

  // Check if contract already exists for this owner
  const existing = await db
    .select()
    .from(tip20Contracts)
    .where(and(eq(tip20Contracts.owner, owner), eq(tip20Contracts.address, data.address)))
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError('TIP-20 contract with this address already exists');
  }

  const result = await db
    .insert(tip20Contracts)
    .values({
      owner,
      address: data.address,
      name: data.name,
      symbol: data.symbol,
      currency: data.currency,
      creator: data.creator,
      txHash: data.txHash,
    })
    .returning();

  return success(c, result[0], 201);
});

/**
 * DELETE /v1/tip20-contracts/:id
 * Delete a TIP-20 contract record
 */
tip20Router.delete('/:id', zValidator('param', idParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { id } = c.req.valid('param');

  // Verify the contract exists and belongs to the user
  const existing = await db
    .select()
    .from(tip20Contracts)
    .where(and(eq(tip20Contracts.id, id), eq(tip20Contracts.owner, owner)))
    .limit(1);

  if (existing.length === 0) {
    throw new NotFoundError('TIP-20 contract not found');
  }

  await db.delete(tip20Contracts).where(eq(tip20Contracts.id, id));

  return noContent(c);
});

export default tip20Router;
