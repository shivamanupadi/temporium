import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { verifyMessage } from 'viem';
import { randomBytes } from 'crypto';

export interface TokenResponse {
  accessToken: string;
  expiresIn: number;
}

export interface ChallengeResponse {
  message: string;
  nonce: string;
  expiresAt: number;
}

// SIWE message constants
const SIWE_DOMAIN = 'temporium.xyz';
const SIWE_URI = 'https://temporium.xyz';
const SIWE_VERSION = '1';
const SIWE_CHAIN_ID = 42429; // Tempo Testnet
const CHALLENGE_EXPIRY_MINUTES = 5;

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

  /**
   * Generate a SIWE challenge for external wallet authentication
   * Stateless - no database storage required
   */
  generateChallenge(address: string): ChallengeResponse {
    // Generate a random nonce (prevents cross-site request forgery)
    const nonce = randomBytes(16).toString('hex');

    // Calculate expiry time
    const expiresAt = new Date(
      Date.now() + CHALLENGE_EXPIRY_MINUTES * 60 * 1000,
    );
    const issuedAt = new Date().toISOString();
    const expirationTime = expiresAt.toISOString();

    // Build SIWE message
    const message = this.buildSiweMessage({
      address,
      nonce,
      issuedAt,
      expirationTime,
    });

    return {
      message,
      nonce,
      expiresAt: expiresAt.getTime(),
    };
  }

  /**
   * Verify a SIWE signature and return a JWT token
   * Stateless verification - checks timestamp in message
   */
  async verifySignature(
    message: string,
    signature: `0x${string}`,
    address: string,
  ): Promise<TokenResponse> {
    const normalizedAddress = address.toLowerCase();

    // Extract and validate expiration time from message
    const expirationMatch = message.match(
      /Expiration Time: (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z)/,
    );
    if (!expirationMatch) {
      throw new UnauthorizedException(
        'Invalid message format: missing expiration time',
      );
    }

    const expirationTime = new Date(expirationMatch[1]);
    if (new Date() > expirationTime) {
      throw new UnauthorizedException('Challenge expired');
    }

    // Extract and validate issued at time (prevent old messages)
    const issuedAtMatch = message.match(
      /Issued At: (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z)/,
    );
    if (!issuedAtMatch) {
      throw new UnauthorizedException(
        'Invalid message format: missing issued at time',
      );
    }

    const issuedAt = new Date(issuedAtMatch[1]);
    const maxAge = CHALLENGE_EXPIRY_MINUTES * 60 * 1000;
    if (Date.now() - issuedAt.getTime() > maxAge) {
      throw new UnauthorizedException('Challenge too old');
    }

    // Verify the address in the message matches the claimed address
    const addressMatch = message.match(/0x[a-fA-F0-9]{40}/);
    if (!addressMatch || addressMatch[0].toLowerCase() !== normalizedAddress) {
      throw new UnauthorizedException('Address mismatch');
    }

    // Verify the signature using viem
    const isValid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature,
    });

    if (!isValid) {
      throw new UnauthorizedException('Invalid signature');
    }

    // Generate and return JWT token
    return this.generateToken(normalizedAddress);
  }

  /**
   * Build a SIWE-compatible message
   */
  private buildSiweMessage(params: {
    address: string;
    nonce: string;
    issuedAt: string;
    expirationTime: string;
  }): string {
    return `${SIWE_DOMAIN} wants you to sign in with your Ethereum account:
${params.address}

Sign this message to authenticate with Temporium.

URI: ${SIWE_URI}
Version: ${SIWE_VERSION}
Chain ID: ${SIWE_CHAIN_ID}
Nonce: ${params.nonce}
Issued At: ${params.issuedAt}
Expiration Time: ${params.expirationTime}`;
  }
}
