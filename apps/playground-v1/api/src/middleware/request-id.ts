import { createMiddleware } from 'hono/factory';
import type { Env, Variables } from '../types/env';

export const requestId = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    const existingId = c.req.header('X-Request-ID');
    const id = existingId || crypto.randomUUID();
    c.set('requestId', id);
    c.header('X-Request-ID', id);
    await next();
  }
);
