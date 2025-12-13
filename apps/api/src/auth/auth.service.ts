import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  /**
   * Generate JWT tokens after successful passkey authentication
   * This is called by the Keys module after validating the passkey signature
   */
  async generateTokens(walletAddress: string): Promise<TokenPair> {
    const payload = {
      walletAddress,
      sub: walletAddress,
    };

    const expiresInSeconds = this.getExpiresInSeconds(
      this.configService.get<string>('JWT_ACCESS_EXPIRATION', '1h'),
    );

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: expiresInSeconds,
    });

    const refreshToken = randomBytes(64).toString('hex');
    const refreshExpiration = this.configService.get<string>(
      'JWT_REFRESH_EXPIRATION',
      '7d',
    );

    // Parse refresh expiration (e.g., '7d' -> 7 days)
    const expiresAt = this.parseExpiration(refreshExpiration);

    // Store refresh token in database
    await this.prisma.session.create({
      data: {
        walletAddress,
        refreshToken,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: expiresInSeconds,
    };
  }

  /**
   * Refresh access token using a valid refresh token
   */
  async refreshTokens(refreshToken: string): Promise<TokenPair | null> {
    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
    });

    if (!session || session.expiresAt < new Date()) {
      // Delete expired session if exists
      if (session) {
        await this.prisma.session.delete({ where: { id: session.id } });
      }
      return null;
    }

    // Delete old session
    await this.prisma.session.delete({ where: { id: session.id } });

    // Generate new tokens
    return this.generateTokens(session.walletAddress);
  }

  /**
   * Revoke a refresh token (logout)
   */
  async revokeToken(refreshToken: string): Promise<boolean> {
    try {
      await this.prisma.session.delete({
        where: { refreshToken },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Revoke all sessions for a wallet (logout everywhere)
   */
  async revokeAllTokens(walletAddress: string): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: { walletAddress },
    });
    return result.count;
  }

  private parseExpiration(exp: string): Date {
    const match = exp.match(/^(\d+)([smhd])$/);
    if (!match) {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return new Date(Date.now() + value * multipliers[unit]);
  }

  private getExpiresInSeconds(exp: string): number {
    const match = exp.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 3600; // Default 1 hour
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
}
