import { cors } from 'hono/cors';

export function createCorsMiddleware(allowedOrigins: string) {
  const origins = allowedOrigins === '*' ? '*' : allowedOrigins.split(',').map(o => o.trim());

  return cors({
    origin: origins,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 86400,
    credentials: true,
  });
}
