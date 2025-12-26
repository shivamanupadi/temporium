import { createMiddleware } from 'hono/factory';
import type { Env, Variables } from '../types/env';

/**
 * Generate a unique request ID using crypto.randomUUID()
 */
function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Request ID middleware
 * Adds a unique request ID to each request for tracing and debugging
 */
export const requestId = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    // Use existing request ID from header or generate a new one
    const existingId = c.req.header('X-Request-ID');
    const id = existingId || generateRequestId();

    // Set request ID in context for use in handlers and error logging
    c.set('requestId', id);

    // Add request ID to response headers
    c.header('X-Request-ID', id);

    await next();
  }
);
