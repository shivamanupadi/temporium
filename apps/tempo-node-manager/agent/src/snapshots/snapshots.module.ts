import { Module } from '@nestjs/common';
import { SnapshotsController } from './snapshots.controller';
import { SnapshotsService } from './snapshots.service';
import { DockerModule } from '../docker/docker.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DockerModule, DatabaseModule],
  controllers: [SnapshotsController],
  providers: [SnapshotsService],
  exports: [SnapshotsService],
})
export class SnapshotsModule {}
