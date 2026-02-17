import { Hono } from 'hono';
import { success } from '../lib/response';
import { TEMPLATES } from '../lib/templates';
import type { Env, Variables } from '../types/env';

const templatesRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /v1/templates — List available templates (no auth required)
 */
templatesRouter.get('/', async c => {
  const templateList = TEMPLATES.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    icon: t.icon,
  }));

  return success(c, templateList);
});

export default templatesRouter;
