import { cors } from 'hono/cors';

export function createCorsMiddleware(allowedOrigins: string) {
  const origins = allowedOrigins === '*' ? '*' : allowedOrigins.split(',').map(o => o.trim());

  return cors({
    origin: origins,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Tempo-Network'],
    // `WWW-Authenticate` carries the mppx 402 challenge; `Payment-Receipt`
    // carries the settlement proof on 200. Browsers hide non-simple response
    // headers from JS unless they are explicitly exposed, so mppx/client
    // needs both of these listed here to drive its challenge/receipt flow.
    exposeHeaders: ['Content-Length', 'WWW-Authenticate', 'Payment-Receipt'],
    maxAge: 86400,
    credentials: true,
  });
}
