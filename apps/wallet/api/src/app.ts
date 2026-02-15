import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';
import { createCorsMiddleware } from './middleware/cors';
import { requestId } from './middleware/request-id';
import { errorHandler } from './middleware/error';
import { networkMiddleware } from './middleware/network';
import routes from './routes';
import type { Env, Variables } from './types/env';

export function createApp() {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();

  // Security headers
  app.use('*', secureHeaders());

  // Request ID for tracing (must be early in chain)
  app.use('*', requestId);

  // Logging with request ID
  app.use(
    '*',
    logger((message, ...rest) => {
      console.log(message, ...rest);
    })
  );

  // Pretty JSON in development
  app.use('*', prettyJSON());

  // CORS - applied per-request to access env
  app.use('*', async (c, next) => {
    const corsMiddleware = createCorsMiddleware(c.env.ALLOWED_ORIGINS || '*');
    return corsMiddleware(c, next);
  });

  // Network resolution from X-Tempo-Network header
  app.use('*', networkMiddleware);

  // Health check endpoints
  app.get('/', c => {
    return c.json({
      success: true,
      data: {
        name: 'Temporium API',
        version: '2.0.0',
        runtime: 'Cloudflare Workers',
        status: 'healthy',
      },
    });
  });

  app.get('/health', c => {
    return c.json({
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
      },
    });
  });

  // Mount all routes
  app.route('/', routes);

  // Global error handler
  app.onError(errorHandler);

  // 404 handler
  app.notFound(c => {
    const reqId = c.get('requestId');
    return c.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Route ${c.req.method} ${c.req.path} not found`,
          requestId: reqId,
        },
      },
      404
    );
  });

  return app;
}
