import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { NodeModule } from './node/node.module';
import { LogsModule } from './logs/logs.module';
import { MetricsModule } from './metrics/metrics.module';
import { SnapshotsModule } from './snapshots/snapshots.module';
import { DockerModule } from './docker/docker.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { UpdateModule } from './update/update.module';
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

    // Serve static files from web build
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'web', 'dist'),
      exclude: ['/api/(.*)'],
    }),

    // Feature modules
    AuthModule,
    DockerModule,
    NodeModule,
    LogsModule,
    MetricsModule,
    SnapshotsModule,
    MonitoringModule,
    UpdateModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
