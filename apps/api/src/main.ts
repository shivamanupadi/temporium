import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Disable body parsing for raw access - KeysMiddleware needs raw body
    // Body parsing is added after middleware registration in KeysModule
    bodyParser: false,
  });

  // Add body parsing for all routes (KeysMiddleware handles its own raw body parsing)
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
