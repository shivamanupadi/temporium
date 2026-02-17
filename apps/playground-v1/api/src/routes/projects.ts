import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc } from 'drizzle-orm';
import { jwtAuth, getWalletAddress } from '../middleware/auth';
import { NotFoundError } from '../middleware/error';
import { createDb, projects, projectFiles } from '../db';
import {
  createProjectSchema,
  updateProjectSchema,
  createFileSchema,
  updateFileSchema,
  idParamSchema,
  fileIdParamSchema,
} from '../lib/validation';
import { success, noContent } from '../lib/response';
import type { Env, Variables } from '../types/env';
import { TEMPLATES, getTemplateFiles } from '../lib/templates';

const projectsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

projectsRouter.use('/*', jwtAuth);

/**
 * GET /v1/projects — List user's projects
 */
projectsRouter.get('/', async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);

  const result = await db
    .select()
    .from(projects)
    .where(eq(projects.owner, owner))
    .orderBy(desc(projects.updatedAt));

  // Count files per project
  const projectIds = result.map(p => p.id);
  const fileCounts: Record<string, number> = {};

  if (projectIds.length > 0) {
    for (const pid of projectIds) {
      const files = await db
        .select()
        .from(projectFiles)
        .where(eq(projectFiles.projectId, pid));
      fileCounts[pid] = files.length;
    }
  }

  const data = result.map(p => ({
    ...p,
    fileCount: fileCounts[p.id] || 0,
  }));

  return success(c, data);
});

/**
 * GET /v1/projects/:id — Get project with all files
 */
projectsRouter.get('/:id', zValidator('param', idParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { id } = c.req.valid('param');

  const result = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.owner, owner)))
    .limit(1);

  if (result.length === 0) throw new NotFoundError('Project not found');

  const files = await db
    .select()
    .from(projectFiles)
    .where(eq(projectFiles.projectId, id))
    .orderBy(projectFiles.path);

  return success(c, { ...result[0], files });
});

/**
 * POST /v1/projects — Create project
 */
projectsRouter.post('/', zValidator('json', createProjectSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { name, templateId } = c.req.valid('json');

  const result = await db
    .insert(projects)
    .values({ owner, name, templateId })
    .returning();

  const project = result[0];

  // If a template was selected, create its files
  if (templateId) {
    const templateFiles = getTemplateFiles(templateId);
    if (templateFiles.length > 0) {
      await db.insert(projectFiles).values(
        templateFiles.map(f => ({
          projectId: project.id,
          path: f.path,
          content: f.content,
        }))
      );
    }
  }

  // Fetch the created project with files
  const files = await db
    .select()
    .from(projectFiles)
    .where(eq(projectFiles.projectId, project.id));

  return success(c, { ...project, files }, 201);
});

/**
 * PATCH /v1/projects/:id — Rename project
 */
projectsRouter.patch(
  '/:id',
  zValidator('param', idParamSchema),
  zValidator('json', updateProjectSchema),
  async c => {
    const db = createDb(c.env.DB);
    const owner = getWalletAddress(c);
    const { id } = c.req.valid('param');
    const { name } = c.req.valid('json');

    const existing = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.owner, owner)))
      .limit(1);

    if (existing.length === 0) throw new NotFoundError('Project not found');

    const result = await db
      .update(projects)
      .set({ name, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();

    return success(c, result[0]);
  }
);

/**
 * DELETE /v1/projects/:id — Delete project (cascades files)
 */
projectsRouter.delete('/:id', zValidator('param', idParamSchema), async c => {
  const db = createDb(c.env.DB);
  const owner = getWalletAddress(c);
  const { id } = c.req.valid('param');

  const existing = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.owner, owner)))
    .limit(1);

  if (existing.length === 0) throw new NotFoundError('Project not found');

  await db.delete(projects).where(eq(projects.id, id));

  return noContent(c);
});

// ============ File Routes ============

/**
 * POST /v1/projects/:id/files — Create file
 */
projectsRouter.post(
  '/:id/files',
  zValidator('param', idParamSchema),
  zValidator('json', createFileSchema),
  async c => {
    const db = createDb(c.env.DB);
    const owner = getWalletAddress(c);
    const { id } = c.req.valid('param');
    const { path, content } = c.req.valid('json');

    // Verify project ownership
    const project = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.owner, owner)))
      .limit(1);

    if (project.length === 0) throw new NotFoundError('Project not found');

    const result = await db
      .insert(projectFiles)
      .values({ projectId: id, path, content })
      .returning();

    // Update project updatedAt
    await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, id));

    return success(c, result[0], 201);
  }
);

/**
 * PATCH /v1/projects/:id/files/:fileId — Update file
 */
projectsRouter.patch(
  '/:id/files/:fileId',
  zValidator('param', fileIdParamSchema),
  zValidator('json', updateFileSchema),
  async c => {
    const db = createDb(c.env.DB);
    const owner = getWalletAddress(c);
    const { id, fileId } = c.req.valid('param');

    // Verify project ownership
    const project = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.owner, owner)))
      .limit(1);

    if (project.length === 0) throw new NotFoundError('Project not found');

    const existing = await db
      .select()
      .from(projectFiles)
      .where(and(eq(projectFiles.id, fileId), eq(projectFiles.projectId, id)))
      .limit(1);

    if (existing.length === 0) throw new NotFoundError('File not found');

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    const body = c.req.valid('json');
    if (body.path !== undefined) updates.path = body.path;
    if (body.content !== undefined) updates.content = body.content;

    const result = await db
      .update(projectFiles)
      .set(updates)
      .where(eq(projectFiles.id, fileId))
      .returning();

    // Update project updatedAt
    await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, id));

    return success(c, result[0]);
  }
);

/**
 * DELETE /v1/projects/:id/files/:fileId — Delete file
 */
projectsRouter.delete(
  '/:id/files/:fileId',
  zValidator('param', fileIdParamSchema),
  async c => {
    const db = createDb(c.env.DB);
    const owner = getWalletAddress(c);
    const { id, fileId } = c.req.valid('param');

    const project = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.owner, owner)))
      .limit(1);

    if (project.length === 0) throw new NotFoundError('Project not found');

    const existing = await db
      .select()
      .from(projectFiles)
      .where(and(eq(projectFiles.id, fileId), eq(projectFiles.projectId, id)))
      .limit(1);

    if (existing.length === 0) throw new NotFoundError('File not found');

    await db.delete(projectFiles).where(eq(projectFiles.id, fileId));

    return noContent(c);
  }
);

export default projectsRouter;
