import { Injectable, NestMiddleware, Logger, HttpStatus } from '@nestjs/common';
import type { Request as ExpressRequest, Response } from 'express';
import { Handler } from 'tempo.ts/server';
import { KeysService } from './keys.service';
import { AuthService } from '../auth/auth.service';
import {
  TempoPublicKeyResponse,
  AuthenticatedCredentialResponseDto,
  KeysErrorResponseDto,
} from './dto/keys.dto';

/** Endpoints that should not receive JWT tokens */
const EXCLUDED_ENDPOINTS = ['challenge'] as const;

/** HTTP methods that don't have request bodies */
const BODYLESS_METHODS = ['GET', 'HEAD', 'OPTIONS'] as const;

/** Type alias for Fetch API Request to avoid confusion with Express Request */
type FetchRequest = globalThis.Request;

@Injectable()
export class KeysMiddleware implements NestMiddleware {
  private readonly logger = new Logger(KeysMiddleware.name);
  private readonly keysHandler: ReturnType<typeof Handler.keyManager>;

  constructor(
    private readonly keysService: KeysService,
    private readonly authService: AuthService,
  ) {
    this.keysHandler = Handler.keyManager({
      kv: this.keysService,
      path: '',
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

    this.logger.log('Keys middleware initialized');
  }

  async use(req: ExpressRequest, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const result = await this.handleRequest(req, requestId);
      this.sendResponse(res, result, req, requestId, startTime);
    } catch (error) {
      this.handleError(error, res, req, requestId, startTime);
    }
  }

  /**
   * Main request handling logic
   */
  private async handleRequest(
    req: ExpressRequest,
    requestId: string,
  ): Promise<{
    status: number;
    body: string | AuthenticatedCredentialResponseDto;
    headers: Headers;
  }> {
    // Collect raw request body
    const bodyBuffer = await this.collectRequestBody(req);

    // Build URL for tempo.ts handler
    const url = this.buildRequestUrl(req);

    this.logger.debug(
      `[${requestId}] Processing ${req.method} ${req.path} -> ${url}`,
    );

    // Create fetch request for tempo.ts
    const fetchRequest = this.createFetchRequest(req, url, bodyBuffer);

    // Call tempo.ts handler
    const response = await this.keysHandler.fetch(fetchRequest);
    const responseBody = await response.text();

    // Check if we should inject JWT token
    const credentialId = this.extractCredentialId(req.path);

    if (this.shouldInjectToken(response.status, credentialId)) {
      const authenticatedResponse = await this.createAuthenticatedResponse(
        req.method,
        credentialId,
        responseBody,
        requestId,
      );

      if (authenticatedResponse) {
        return {
          status: HttpStatus.OK,
          body: authenticatedResponse,
          headers: response.headers,
        };
      }
    }

    return {
      status: response.status,
      body: responseBody,
      headers: response.headers,
    };
  }

  /**
   * Collect raw request body from stream
   */
  private async collectRequestBody(req: ExpressRequest): Promise<Buffer> {
    const chunks: Buffer[] = [];

    for await (const chunk of req) {
      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
      } else if (typeof chunk === 'string') {
        chunks.push(Buffer.from(chunk));
      }
    }

    return Buffer.concat(chunks);
  }

  /**
   * Build the URL for tempo.ts handler
   * Uses the original request protocol and host to work with any domain
   */
  private buildRequestUrl(req: ExpressRequest): string {
    // Get protocol (handle proxy scenarios with x-forwarded-proto)
    const protocol =
      (req.headers['x-forwarded-proto'] as string) ||
      (req.secure ? 'https' : 'http');

    // Get host (handle proxy scenarios with x-forwarded-host)
    const host =
      (req.headers['x-forwarded-host'] as string) ||
      req.headers.host ||
      `localhost:${process.env.PORT || 3001}`;

    return `${protocol}://${host}${req.path}`;
  }

  /**
   * Create a Fetch API Request object for tempo.ts
   */
  private createFetchRequest(
    req: ExpressRequest,
    url: string,
    bodyBuffer: Buffer,
  ): FetchRequest {
    const headers = new Headers();

    // Copy relevant headers
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') {
        headers.set(key, value);
      } else if (Array.isArray(value)) {
        headers.set(key, value.join(', '));
      }
    }

    const hasBody = !BODYLESS_METHODS.includes(
      req.method as (typeof BODYLESS_METHODS)[number],
    );

    return new globalThis.Request(url, {
      method: req.method,
      headers,
      body: hasBody ? new Uint8Array(bodyBuffer) : undefined,
    });
  }

  /**
   * Extract credential ID from request path
   */
  private extractCredentialId(path: string): string {
    // Remove leading slash and any additional path segments
    return path.replace(/^\//, '').split('/')[0];
  }

  /**
   * Check if JWT token should be injected into response
   */
  private shouldInjectToken(status: number, credentialId: string): boolean {
    const isSuccessful = status >= 200 && status < 300;
    const hasCredentialId = Boolean(credentialId);
    const isExcluded = EXCLUDED_ENDPOINTS.includes(
      credentialId as (typeof EXCLUDED_ENDPOINTS)[number],
    );

    return isSuccessful && hasCredentialId && !isExcluded;
  }

  /**
   * Create authenticated response with JWT token
   */
  private async createAuthenticatedResponse(
    method: string,
    credentialId: string,
    responseBody: string,
    requestId: string,
  ): Promise<AuthenticatedCredentialResponseDto | null> {
    let publicKey: string | undefined;

    try {
      if (method === 'POST') {
        // For POST (credential creation), retrieve from storage
        publicKey = await this.keysService.get<string>(
          `credential:${credentialId}`,
        );
      } else if (method === 'GET' && responseBody) {
        // For GET (authentication), parse from response
        publicKey = this.parsePublicKeyFromResponse(responseBody);
      }

      if (!publicKey) {
        this.logger.debug(
          `[${requestId}] No public key found for credential: ${credentialId}`,
        );
        return null;
      }

      const token = this.authService.generateToken(credentialId);

      this.logger.log(
        `[${requestId}] Generated JWT token for credential: ${credentialId}`,
      );

      return {
        publicKey,
        ...token,
      };
    } catch (error) {
      this.logger.error(
        `[${requestId}] Failed to create authenticated response: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Parse public key from tempo.ts response body
   */
  private parsePublicKeyFromResponse(responseBody: string): string | undefined {
    try {
      const data = JSON.parse(responseBody) as TempoPublicKeyResponse;
      return data.publicKey;
    } catch {
      return undefined;
    }
  }

  /**
   * Send successful response
   */
  private sendResponse(
    res: Response,
    result: {
      status: number;
      body: string | AuthenticatedCredentialResponseDto;
      headers: Headers;
    },
    req: ExpressRequest,
    requestId: string,
    startTime: number,
  ): void {
    // Copy response headers
    result.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    const duration = Date.now() - startTime;

    this.logger.log(
      `[${requestId}] ${req.method} ${req.path} -> ${result.status} (${duration}ms)`,
    );

    if (typeof result.body === 'string') {
      res.status(result.status).send(result.body);
    } else {
      res.status(result.status).json(result.body);
    }
  }

  /**
   * Handle errors and send error response
   */
  private handleError(
    error: unknown,
    res: Response,
    req: ExpressRequest,
    requestId: string,
    startTime: number,
  ): void {
    const duration = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    this.logger.error(
      `[${requestId}] ${req.method} ${req.path} failed after ${duration}ms: ${errorMessage}`,
      errorStack,
    );

    // Don't expose internal error details in production
    const isProduction = process.env.NODE_ENV === 'production';

    const errorResponse: KeysErrorResponseDto = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: isProduction
        ? 'An error occurred processing your request'
        : errorMessage,
      error: 'Internal Server Error',
      path: req.path,
      timestamp: new Date().toISOString(),
    };

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
  }

  /**
   * Generate unique request ID for tracing
   */
  private generateRequestId(): string {
    return `keys-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
