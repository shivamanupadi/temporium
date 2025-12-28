import { Module } from '@nestjs/common';
import { NodeController } from './node.controller';
import { PublicStatusController } from './public-status.controller';
import { NodeService } from './node.service';

@Module({
  controllers: [NodeController, PublicStatusController],
  providers: [NodeService],
  exports: [NodeService],
})
export class NodeModule {}
