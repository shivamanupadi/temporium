import { sign } from 'hono/jwt';
import type { JwtPayload } from '../types/env';

export interface TokenResponse {
  accessToken: string;
  expiresIn: number;
}

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

  const accessToken = await sign(payload, jwtSecret);

  return { accessToken, expiresIn };
}

function parseExpiration(exp: string): number {
  const match = exp.match(/^(\d+)([smhd])$/);
  if (!match) return 24 * 60 * 60;

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
