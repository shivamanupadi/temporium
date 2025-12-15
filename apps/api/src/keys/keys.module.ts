import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { KeysService } from './keys.service';
import { KeysMiddleware } from './keys.middleware';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [KeysService, KeysMiddleware],
  exports: [KeysService],
})
export class KeysModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(KeysMiddleware).forRoutes('keys');
  }
}
