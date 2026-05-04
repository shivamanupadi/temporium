import { createMiddleware } from 'hono/factory';
import { verify } from 'hono/jwt';
import type { Env, Variables, JwtPayload } from '../types/env';

/**
 * JWT Authentication Middleware
 * Verifies the Bearer token and sets the user in context
 */
export const jwtAuth = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return c.json(
        { error: 'Unauthorized', message: 'Missing or invalid authorization header' },
        401
      );
    }

    const token = authHeader.slice(7);

    try {
      // hono v4 requires an explicit `alg` arg on verify (sign defaults to HS256
      // but verify throws JwtAlgorithmRequired without it). Must match the
      // algorithm used in lib/jwt.ts → generateToken. Without this, every authed
      // request 401s right after sign-in, which the web app interprets as "log
      // me out" — the original "auto-logout on sign-in" bug.
      const decoded = await verify(token, c.env.JWT_SECRET, 'HS256');

      // Map the decoded JWT to our JwtPayload structure
      const payload: JwtPayload = {
        walletAddress: decoded.walletAddress as string,
        sub: decoded.sub as string,
        iat: decoded.iat as number,
        exp: decoded.exp as number,
      };

      c.set('user', payload);
      await next();
    } catch (error) {
      console.error(
        `[auth] verify failed on ${c.req.path}:`,
        error instanceof Error ? `${error.name}: ${error.message}` : error
      );
      return c.json({ error: 'Unauthorized', message: 'Invalid or expired token' }, 401);
    }
  }
);

/**
 * Get the authenticated user's wallet address
 */
export function getWalletAddress(c: { get: (key: 'user') => JwtPayload }): string {
  return c.get('user').walletAddress.toLowerCase();
}
