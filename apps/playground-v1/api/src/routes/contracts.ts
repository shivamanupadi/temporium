import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc } from 'drizzle-orm';
import { jwtAuth, getWalletAddress } from '../middleware/auth';
import { NotFoundError } from '../middleware/error';
import { createDb, deployedContracts } from '../db';
import { createContractSchema, idParamSchema } from '../lib/validation';
import { success, noContent } from '../lib/response';
import type { Env, Variables } from '../types/env';

const contractsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

contractsRouter.use('/*', jwtAuth);

/**
 * GET /v1/contracts — List deployed contracts
 */
contractsRouter.get('/', async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);

  const result = await db
    .select()
    .from(deployedContracts)
    .where(eq(deployedContracts.owner, owner))
    .orderBy(desc(deployedContracts.deployedAt));

  return success(c, result);
});

/**
 * POST /v1/contracts — Save deployed contract
 */
contractsRouter.post('/', zValidator('json', createContractSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const body = c.req.valid('json');

  const result = await db
    .insert(deployedContracts)
    .values({ ...body, owner })
    .returning();

  return success(c, result[0], 201);
});

/**
 * DELETE /v1/contracts/:id — Delete contract record
 */
contractsRouter.delete('/:id', zValidator('param', idParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { id } = c.req.valid('param');

  const existing = await db
    .select()
    .from(deployedContracts)
    .where(and(eq(deployedContracts.id, id), eq(deployedContracts.owner, owner)))
    .limit(1);

  if (existing.length === 0) throw new NotFoundError('Contract not found');

  await db.delete(deployedContracts).where(eq(deployedContracts.id, id));

  return noContent(c);
});

export default contractsRouter;
