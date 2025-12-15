import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  // Create Fastify adapter with rawBody enabled for /keys routes
  const adapter = new FastifyAdapter({
    logger: false,
    bodyLimit: 10 * 1024 * 1024, // 10MB
  });

  // Get the raw Fastify instance before NestJS registers parsers
  const fastifyInstance = adapter.getInstance();

  // Use preParsing hook to preserve raw body for /keys routes
  fastifyInstance.addHook('preParsing', async (request, _reply, payload) => {
    if (request.url.startsWith('/keys')) {
      const chunks: Buffer[] = [];
      for await (const chunk of payload) {
        chunks.push(chunk as Buffer);
      }
      const rawBody = Buffer.concat(chunks);
      // Store raw body on request for middleware to access
      (request as unknown as { rawBody: Buffer }).rawBody = rawBody;
      // Return the raw body as a stream for Fastify to parse
      const { Readable } = await import('stream');
      return Readable.from([rawBody]);
    }
    return payload;
  });

  // Add custom header to identify Fastify
  fastifyInstance.addHook('onSend', async (_request, reply) => {
    reply.header('X-Powered-By', 'Fastify');
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
  );

  // Enable CORS - allow all origins
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  );

  // Enable global exception filter for consistent error responses
  app.useGlobalFilters(new HttpExceptionFilter());

  // Enable URI versioning (e.g., /v1/contacts, /v1/policies)
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');

  logger.log(`Temporium API running on http://localhost:${port} (Fastify)`);
  logger.log(`Keys endpoint: http://localhost:${port}/keys`);
  logger.log(`API endpoints: http://localhost:${port}/v1/*`);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
