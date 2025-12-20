import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KeysService } from './keys.service';
import { KeysController } from './keys.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [KeysController],
  providers: [KeysService],
  exports: [KeysService],
})
export class KeysModule {}
