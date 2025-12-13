import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization',
  });

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Set global prefix for API routes (except /keys which needs to match tempo.ts)
  app.setGlobalPrefix('api', {
    exclude: ['keys', 'keys/(.*)', 'health'],
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🚀 Tollr API running on http://localhost:${port}`);
  console.log(`📡 Keys endpoint: http://localhost:${port}/keys`);
  console.log(`🔐 Protected endpoints: http://localhost:${port}/api/*`);
}

bootstrap();
