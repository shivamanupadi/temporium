import { Controller, Post, Body } from '@nestjs/common';
import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { AuthService } from './auth.service';
import type { ChallengeResponse, TokenResponse } from './auth.service';

// Ethereum address regex
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

// DTOs for SIWE authentication
class ChallengeDto {
  @IsString()
  @Matches(ADDRESS_REGEX, { message: 'Invalid wallet address format' })
  address: string;
}

class VerifyDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsNotEmpty()
  signature: string;

  @IsString()
  @Matches(ADDRESS_REGEX, { message: 'Invalid wallet address format' })
  address: string;
}

/**
 * Auth controller for external wallet authentication (SIWE)
 *
 * JWT tokens for passkey users are generated in the Keys module.
 * This controller handles Sign-In with Ethereum for MetaMask/injected wallets.
 */
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Generate a SIWE challenge message for wallet signature
   * POST /v1/auth/challenge
   */
  @Post('challenge')
  getChallenge(@Body() dto: ChallengeDto): ChallengeResponse {
    return this.authService.generateChallenge(dto.address);
  }

  /**
   * Verify a signed SIWE message and return JWT token
   * POST /v1/auth/verify
   */
  @Post('verify')
  async verify(@Body() dto: VerifyDto): Promise<TokenResponse> {
    return this.authService.verifySignature(
      dto.message,
      dto.signature as `0x${string}`,
      dto.address,
    );
  }
}
