import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { NodeModule } from './node/node.module';
import { LogsModule } from './logs/logs.module';
import { DockerModule } from './docker/docker.module';
import { UpdateModule } from './update/update.module';
import { SystemModule } from './system/system.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),

    // Rate limiting - 100 requests per minute
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Database
    DatabaseModule,

    // Serve static files from web build
    // __dirname is /opt/tempo-node-manager/dist/api/src in production
    // Web files are at /opt/tempo-node-manager/dist/web/dist
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'web', 'dist'),
      exclude: ['/api/(.*)'],
    }),

    // Feature modules
    AuthModule,
    DockerModule,
    NodeModule,
    LogsModule,
    UpdateModule,
    SystemModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
