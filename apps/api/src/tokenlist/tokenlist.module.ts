import { Module } from '@nestjs/common';
import { TokenlistController } from './tokenlist.controller';

@Module({
  controllers: [TokenlistController],
})
export class TokenlistModule {}
