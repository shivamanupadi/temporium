import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { KeysModule } from './keys/keys.module';
import { TokenlistModule } from './tokenlist/tokenlist.module';
import { ContactsModule } from './contacts/contacts.module';
import { Tip20StudioModule } from './tip20-studio/tip20-studio.module';
import { PoliciesModule } from './policies/policies.module';
import { ScheduledTransactionsModule } from './scheduled-transactions/scheduled-transactions.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Rate limiting: 60 requests per minute per IP
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 1 minute
        limit: 60, // 60 requests per minute
      },
      {
        name: 'strict',
        ttl: 60000, // 1 minute
        limit: 10, // 10 requests per minute (for sensitive endpoints)
      },
    ]),
    PrismaModule,
    AuthModule,
    KeysModule,
    TokenlistModule,
    ContactsModule,
    Tip20StudioModule,
    PoliciesModule,
    ScheduledTransactionsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
