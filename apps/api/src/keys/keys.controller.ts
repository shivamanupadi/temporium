import { Controller, All, Req, Res, Logger, HttpStatus } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { Handler } from 'tempo.ts/server';
import { KeysService } from './keys.service';
import { AuthService } from '../auth/auth.service';

/** Endpoints that should not receive JWT tokens */
const EXCLUDED_ENDPOINTS = ['challenge'] as const;

/** HTTP methods that don't have request bodies */
const BODYLESS_METHODS = ['GET', 'HEAD', 'OPTIONS'] as const;

interface TempoPublicKeyResponse {
  publicKey?: string;
}

interface AuthenticatedCredentialResponse {
  publicKey: string;
  accessToken: string;
  expiresIn: number;
}

interface KeysErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  path: string;
  timestamp: string;
}

@Controller({ path: 'keys', version: '' })
export class KeysController {
  private readonly logger = new Logger(KeysController.name);
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

    this.logger.log('Keys controller initialized');
  }

  @All()
  async handleRoot(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ): Promise<void> {
    await this.handleKeysRequest(req, res, '');
  }

  @All('*')
  async handleAll(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ): Promise<void> {
    // Extract path after /keys/
    const path = req.url.replace(/^\/keys\/?/, '').split('?')[0];
    await this.handleKeysRequest(req, res, path);
  }

  private async handleKeysRequest(
    req: FastifyRequest,
    res: FastifyReply,
    path: string,
  ): Promise<void> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const result = await this.processRequest(req, path, requestId);
      await this.sendResponse(res, result, req, requestId, startTime);
    } catch (error) {
      await this.handleError(error, res, req, requestId, startTime);
    }
  }

  private async processRequest(
    req: FastifyRequest,
    path: string,
    requestId: string,
  ): Promise<{
    status: number;
    body: string | AuthenticatedCredentialResponse;
    headers: Headers;
  }> {
    // Get raw body from request (stored by preParsing hook in main.ts)
    const bodyBuffer = this.getRequestBody(req);

    // Build URL for tempo.ts handler
    const url = this.buildRequestUrl(req, path);

    this.logger.debug(
      `[${requestId}] Processing ${req.method} /${path} -> ${url}`,
    );

    // Create fetch request for tempo.ts
    const fetchRequest = this.createFetchRequest(req, url, bodyBuffer);

    // Call tempo.ts handler
    const response = await this.keysHandler.fetch(fetchRequest);
    const responseBody = await response.text();

    // Check if we should inject JWT token
    const credentialId = path.split('/')[0];

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

  private getRequestBody(req: FastifyRequest): Buffer {
    // First try to get the raw body stored by our preParsing hook
    const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
    if (rawBody) {
      return rawBody;
    }

    // Fallback: use the parsed body
    const body = req.body;

    if (Buffer.isBuffer(body)) {
      return body;
    }

    if (typeof body === 'string') {
      return Buffer.from(body);
    }

    if (body && typeof body === 'object') {
      return Buffer.from(JSON.stringify(body));
    }

    return Buffer.alloc(0);
  }

  private buildRequestUrl(req: FastifyRequest, path: string): string {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol =
      (typeof forwardedProto === 'string' ? forwardedProto : undefined) ||
      req.protocol ||
      'http';

    const forwardedHost = req.headers['x-forwarded-host'];
    const host =
      (typeof forwardedHost === 'string' ? forwardedHost : undefined) ||
      req.headers.host ||
      `localhost:${process.env.PORT || 3001}`;

    return `${protocol}://${host}/${path}`;
  }

  private createFetchRequest(
    req: FastifyRequest,
    url: string,
    bodyBuffer: Buffer,
  ): globalThis.Request {
    const headers = new Headers();

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

  private shouldInjectToken(status: number, credentialId: string): boolean {
    const isSuccessful = status >= 200 && status < 300;
    const hasCredentialId = Boolean(credentialId);
    const isExcluded = EXCLUDED_ENDPOINTS.includes(
      credentialId as (typeof EXCLUDED_ENDPOINTS)[number],
    );

    return isSuccessful && hasCredentialId && !isExcluded;
  }

  private async createAuthenticatedResponse(
    method: string,
    credentialId: string,
    responseBody: string,
    requestId: string,
  ): Promise<AuthenticatedCredentialResponse | null> {
    let publicKey: string | undefined;

    try {
      if (method === 'POST') {
        publicKey = await this.keysService.get<string>(
          `credential:${credentialId}`,
        );
      } else if (method === 'GET' && responseBody) {
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

  private parsePublicKeyFromResponse(responseBody: string): string | undefined {
    try {
      const data = JSON.parse(responseBody) as TempoPublicKeyResponse;
      return data.publicKey;
    } catch {
      return undefined;
    }
  }

  private async sendResponse(
    res: FastifyReply,
    result: {
      status: number;
      body: string | AuthenticatedCredentialResponse;
      headers: Headers;
    },
    req: FastifyRequest,
    requestId: string,
    startTime: number,
  ): Promise<void> {
    // Copy response headers
    result.headers.forEach((value, key) => {
      res.header(key, value);
    });

    const duration = Date.now() - startTime;

    this.logger.log(
      `[${requestId}] ${req.method} ${req.url} -> ${result.status} (${duration}ms)`,
    );

    if (typeof result.body === 'string') {
      await res.status(result.status).send(result.body);
    } else {
      await res.status(result.status).send(result.body);
    }
  }

  private async handleError(
    error: unknown,
    res: FastifyReply,
    req: FastifyRequest,
    requestId: string,
    startTime: number,
  ): Promise<void> {
    const duration = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    this.logger.error(
      `[${requestId}] ${req.method} ${req.url} failed after ${duration}ms: ${errorMessage}`,
      errorStack,
    );

    const isProduction = process.env.NODE_ENV === 'production';

    const errorResponse: KeysErrorResponse = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: isProduction
        ? 'An error occurred processing your request'
        : errorMessage,
      error: 'Internal Server Error',
      path: req.url,
      timestamp: new Date().toISOString(),
    };

    await res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(errorResponse);
  }

  private generateRequestId(): string {
    return `keys-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
