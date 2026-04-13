import { cors } from 'hono/cors';

// Wildcard CORS is intentional — the API is fronted by its own auth + JWT
// checks, and the set of legitimate callers isn't known at deploy time.
export function createCorsMiddleware() {
  return cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Tempo-Network', 'X-Tempo-Auth'],
    // `WWW-Authenticate` carries the mppx 402 challenge; `Payment-Receipt`
    // carries the settlement proof on 200. Browsers hide non-simple response
    // headers from JS unless they are explicitly exposed, so mppx/client
    // needs both of these listed here to drive its challenge/receipt flow.
    exposeHeaders: ['Content-Length', 'WWW-Authenticate', 'Payment-Receipt'],
    maxAge: 86400,
    credentials: true,
  });
}
