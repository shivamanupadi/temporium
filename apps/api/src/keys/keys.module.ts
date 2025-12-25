import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KeysService } from './keys.service';
import { KeysController } from './keys.controller';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, AuthModule, PrismaModule],
  controllers: [KeysController],
  providers: [KeysService],
  exports: [KeysService],
})
export class KeysModule {}
