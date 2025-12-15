import { Module } from '@nestjs/common';
import { Tip20StudioController } from './tip20-studio.controller';
import { Tip20StudioService } from './tip20-studio.service';

@Module({
  controllers: [Tip20StudioController],
  providers: [Tip20StudioService],
  exports: [Tip20StudioService],
})
export class Tip20StudioModule {}
