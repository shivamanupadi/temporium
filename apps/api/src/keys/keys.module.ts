import { Module } from '@nestjs/common';
import { KeysService } from './keys.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [KeysService],
  exports: [KeysService],
})
export class KeysModule {}
