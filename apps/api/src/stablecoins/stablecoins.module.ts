import { Module } from '@nestjs/common';
import { StablecoinsController } from './stablecoins.controller';
import { StablecoinsService } from './stablecoins.service';

@Module({
  controllers: [StablecoinsController],
  providers: [StablecoinsService],
  exports: [StablecoinsService],
})
export class StablecoinsModule {}
