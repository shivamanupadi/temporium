import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface TokenResponse {
  accessToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Generate JWT token after successful passkey authentication
   * This is called by the Keys module after validating the passkey signature
   */
  generateToken(walletAddress: string): TokenResponse {
    const payload = {
      walletAddress,
      sub: walletAddress,
    };

    const expiresInSeconds = this.getExpiresInSeconds(
      this.configService.get<string>('JWT_EXPIRATION', '24h'),
    );

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: expiresInSeconds,
    });

    return {
      accessToken,
      expiresIn: expiresInSeconds,
    };
  }

  private getExpiresInSeconds(exp: string): number {
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
}
