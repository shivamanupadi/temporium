import { createMiddleware } from 'hono/factory';
import { verify } from 'hono/jwt';
import type { Env, Variables, JwtPayload } from '../types/env';

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
      const decoded = await verify(token, c.env.JWT_SECRET);

      const payload: JwtPayload = {
        walletAddress: decoded.walletAddress as string,
        sub: decoded.sub as string,
        iat: decoded.iat as number,
        exp: decoded.exp as number,
      };

      c.set('user', payload);
      await next();
    } catch (error) {
      return c.json({ error: 'Unauthorized', message: 'Invalid or expired token' }, 401);
    }
  }
);

export function getWalletAddress(c: { get: (key: 'user') => JwtPayload }): string {
  return c.get('user').walletAddress.toLowerCase();
}
