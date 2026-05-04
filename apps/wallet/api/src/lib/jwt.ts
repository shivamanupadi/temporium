import { sign } from 'hono/jwt';
import type { JwtPayload } from '../types/env';

/**
 * JWT token response
 */
export interface TokenResponse {
  accessToken: string;
  expiresIn: number;
}

/**
 * Generate a JWT token for the given wallet address
 */
export async function generateToken(
  walletAddress: string,
  jwtSecret: string,
  expirationStr: string = '24h'
): Promise<TokenResponse> {
  const expiresIn = parseExpiration(expirationStr);
  const now = Math.floor(Date.now() / 1000);

  const payload: Omit<JwtPayload, 'iat' | 'exp'> & { iat: number; exp: number } = {
    walletAddress: walletAddress.toLowerCase(),
    sub: walletAddress.toLowerCase(),
    iat: now,
    exp: now + expiresIn,
  };

  // Explicit alg keeps sign + middleware/auth.ts verify in lockstep.
  // hono v4 requires the algorithm on verify(); pin it here so signed tokens
  // are guaranteed to match what the middleware expects.
  const accessToken = await sign(payload, jwtSecret, 'HS256');

  return {
    accessToken,
    expiresIn,
  };
}

/**
 * Parse expiration string to seconds
 * Supports: s (seconds), m (minutes), h (hours), d (days)
 */
function parseExpiration(exp: string): number {
  const match = exp.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 24 * 60 * 60; // Default 24 hours
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
  };

  return value * multipliers[unit];
}
