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

  app.use('*', secureHeaders());
  app.use('*', requestId);
  app.use(
    '*',
    logger((message, ...rest) => {
      console.log(message, ...rest);
    })
  );
  app.use('*', prettyJSON());

  app.use('*', async (c, next) => {
    const corsMiddleware = createCorsMiddleware(c.env.ALLOWED_ORIGINS || '*');
    return corsMiddleware(c, next);
  });

  app.use('*', networkMiddleware);

  app.get('/', c => {
    return c.json({
      success: true,
      data: {
        name: 'Temporium Playground API',
        version: '1.0.0',
        runtime: 'Cloudflare Workers',
        status: 'healthy',
      },
    });
  });

  app.get('/health', c => {
    return c.json({
      success: true,
      data: { status: 'ok', timestamp: new Date().toISOString() },
    });
  });

  app.route('/', routes);

  app.onError(errorHandler);

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
