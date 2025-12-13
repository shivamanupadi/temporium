import {
  Controller,
  Get,
  Post,
  Res,
  Req,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Handler } from 'tempo.ts/server';
import { KeysService } from './keys.service';
import { AuthService } from '../auth/auth.service';

/**
 * Keys Controller - Migrated from Cloudflare Worker
 * Handles WebAuthn passkey operations using tempo.ts Handler.keyManager
 *
 * IMPORTANT: This is where JWT tokens are issued after successful passkey authentication
 */
@Controller('keys')
export class KeysController {
  private handler: ReturnType<typeof Handler.keyManager>;

  constructor(
    private keysService: KeysService,
    private authService: AuthService,
  ) {
    // Initialize tempo.ts key manager with PostgreSQL-backed Kv
    this.handler = Handler.keyManager({
      kv: this.keysService,
      path: '/keys',
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  /**
   * Handle all keys requests through tempo.ts Handler
   * After successful authentication, we intercept and add JWT tokens
   */
  @Get('*path')
  @Post('*path')
  async handleKeysRequest(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // Convert Express request to Fetch API Request
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        headers.set(key, value);
      }
    });

    const fetchRequest = new Request(url, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method)
        ? undefined
        : JSON.stringify(req.body),
    });

    // Call tempo.ts handler
    const response = await this.handler.fetch(fetchRequest);
    const responseBody = await response.text();

    // Set response headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // Check if this is a successful authentication response
    // If so, add JWT tokens to the response
    if (response.ok && req.method === 'POST' && responseBody) {
      try {
        const data = JSON.parse(responseBody);

        // Check if response contains a public key (successful auth)
        // The publicKey response indicates successful passkey verification
        if (data.publicKey) {
          // Derive wallet address from public key
          // tempo.ts returns the serialized public key, we need to extract the address
          const walletAddress = await this.deriveWalletAddress(data);

          if (walletAddress) {
            // Generate JWT tokens
            const tokens = await this.authService.generateTokens(walletAddress);

            // Return combined response
            res.status(response.status).json({
              ...data,
              ...tokens,
            });
            return;
          }
        }
      } catch {
        // Not a JSON response or parsing failed, return as-is
      }
    }

    res.status(response.status).send(responseBody);
  }

  /**
   * Derive wallet address from tempo.ts public key response
   * This uses the same logic as the frontend wagmi connector
   */
  private async deriveWalletAddress(data: Record<string, unknown>): Promise<string | null> {
    try {
      // The tempo.ts keyManager returns the public key data
      // which can be used to derive the wallet address
      // The actual derivation happens on the frontend via wagmi/viem
      // Here we extract the address if it's included in the response
      if (data.address && typeof data.address === 'string') {
        return data.address;
      }

      // If no address, the frontend will derive it
      // We can still issue tokens using the credentialId as identifier
      // and the frontend will validate the address matches
      if (data.credentialId) {
        // For now, return null - frontend will derive address
        // In production, you might want to derive it server-side
        return null;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * CORS preflight handler
   */
  @Get()
  @Post()
  async handleRoot(@Res() res: Response): Promise<void> {
    res.status(HttpStatus.OK).json({ status: 'ok', service: 'tollr-keys' });
  }
}
