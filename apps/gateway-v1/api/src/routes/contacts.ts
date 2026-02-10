import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc } from 'drizzle-orm';
import { jwtAuth, getWalletAddress } from '../middleware/auth';
import { NotFoundError, ConflictError } from '../middleware/error';
import { createDb, contacts } from '../db';
import { createContactSchema, updateContactSchema, idParamSchema } from '../lib/validation';
import { success, noContent } from '../lib/response';
import type { Env, Variables } from '../types/env';

const contactsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// All routes require authentication
contactsRouter.use('/*', jwtAuth);

/**
 * GET /v1/contacts
 * List all contacts for the authenticated user
 */
contactsRouter.get('/', async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);

  const result = await db
    .select()
    .from(contacts)
    .where(eq(contacts.owner, owner))
    .orderBy(desc(contacts.createdAt));

  return success(c, result);
});

/**
 * GET /v1/contacts/:id
 * Get a specific contact
 */
contactsRouter.get('/:id', zValidator('param', idParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { id } = c.req.valid('param');

  const result = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.owner, owner)))
    .limit(1);

  if (result.length === 0) {
    throw new NotFoundError('Contact not found');
  }

  return success(c, result[0]);
});

/**
 * POST /v1/contacts
 * Create a new contact
 */
contactsRouter.post('/', zValidator('json', createContactSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { name, address } = c.req.valid('json');

  // Check if contact already exists
  const existing = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.owner, owner), eq(contacts.address, address)))
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError('Contact with this address already exists');
  }

  const result = await db
    .insert(contacts)
    .values({
      owner,
      name,
      address,
    })
    .returning();

  return success(c, result[0], 201);
});

/**
 * PATCH /v1/contacts/:id
 * Update a contact
 */
contactsRouter.patch(
  '/:id',
  zValidator('param', idParamSchema),
  zValidator('json', updateContactSchema),
  async c => {
    const db = createDb(c.env.DB);
    const owner = getWalletAddress(c);
    const { id } = c.req.valid('param');
    const { name } = c.req.valid('json');

    // Verify the contact exists and belongs to the user
    const existing = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.owner, owner)))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundError('Contact not found');
    }

    const result = await db
      .update(contacts)
      .set({ name, updatedAt: new Date() })
      .where(eq(contacts.id, id))
      .returning();

    return success(c, result[0]);
  }
);

/**
 * DELETE /v1/contacts/:id
 * Delete a contact
 */
contactsRouter.delete('/:id', zValidator('param', idParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { id } = c.req.valid('param');

  // Verify the contact exists and belongs to the user
  const existing = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.owner, owner)))
    .limit(1);

  if (existing.length === 0) {
    throw new NotFoundError('Contact not found');
  }

  await db.delete(contacts).where(eq(contacts.id, id));

  return noContent(c);
});

export default contactsRouter;
