import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { Handler } from 'tempo.ts/server';
import { AppModule } from './app.module';
import { KeysService } from './keys/keys.service';
import { AuthService } from './auth/auth.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Disable body parsing for raw access - we'll add it back for non-keys routes
    bodyParser: false,
  });

  // Get services for tempo.ts handler
  const keysService = app.get(KeysService);
  const authService = app.get(AuthService);

  // Create tempo.ts key manager handler
  const keysHandler = Handler.keyManager({
    kv: keysService,
    path: '',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });

  // Custom middleware that wraps tempo.ts and adds JWT tokens to successful responses
  app.use('/keys', async (req: Request, res: Response) => {
    try {
      // Collect request body for POST requests
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      const bodyBuffer = Buffer.concat(chunks);

      // Build URL for tempo.ts - use req.path (without /keys prefix since Express strips it)
      const url = `http://localhost:${process.env.PORT || 3001}${req.path}`;
      const headers = new Headers();
      Object.entries(req.headers).forEach(([key, value]) => {
        if (typeof value === 'string') headers.set(key, value);
      });

      // Create fetch request for tempo.ts
      const fetchRequest = new Request(url, {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : bodyBuffer,
      });

      // Call tempo.ts handler directly via fetch API
      const response = await keysHandler.fetch(fetchRequest);
      const responseBody = await response.text();

      // Copy response headers
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      // Add JWT tokens to successful responses for credential endpoints (not /challenge)
      const credentialId = req.path.replace('/', '');
      console.log(
        `[Keys] ${req.method} ${req.path} -> status ${response.status}, credentialId: ${credentialId}`,
      );

      // Handle both GET (sign-in) and POST (wallet creation) for credential endpoints
      if (
        response.status >= 200 &&
        response.status < 300 &&
        credentialId &&
        credentialId !== 'challenge'
      ) {
        try {
          // For POST, get the stored public key (just stored by tempo.ts)
          // For GET, tempo.ts already returns the public key in responseBody
          let publicKey: string | undefined;

          if (req.method === 'POST') {
            publicKey = await keysService.get<string>(
              `credential:${credentialId}`,
            );
          } else if (req.method === 'GET' && responseBody) {
            try {
              const data = JSON.parse(responseBody) as { publicKey?: string };
              publicKey = data.publicKey;
            } catch {
              // Not JSON, skip
            }
          }

          console.log(
            `[Keys] Retrieved publicKey for ${credentialId}:`,
            publicKey ? 'found' : 'not found',
          );

          if (publicKey) {
            const token = authService.generateToken(credentialId);
            const responseData = { publicKey, ...token };
            console.log(
              `[Keys] Returning response with token:`,
              JSON.stringify(responseData, null, 2),
            );
            res.status(200).json(responseData);
            return;
          }
        } catch (error) {
          console.error('Error adding JWT tokens:', error);
        }
      }

      // Return original response
      res.status(response.status).send(responseBody);
    } catch (error) {
      console.error('Keys middleware error:', error);
      res
        .status(500)
        .json({ error: 'Internal server error', details: String(error) });
    }
  });

  // Now add body parsing for all other routes
  const express = await import('express');
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  );

  // Enable URI versioning (e.g., /v1/contacts, /v1/policies)
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🚀 Tollr API running on http://localhost:${port}`);
  console.log(`📡 Keys endpoint: http://localhost:${port}/keys`);
  console.log(`🔐 API endpoints: http://localhost:${port}/v1/*`);
}

void bootstrap();
