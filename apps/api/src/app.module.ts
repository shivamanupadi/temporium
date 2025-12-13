import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { KeysModule } from './keys/keys.module';
import { TokenlistModule } from './tokenlist/tokenlist.module';
import { ContactsModule } from './contacts/contacts.module';
import { StablecoinsModule } from './stablecoins/stablecoins.module';
import { PoliciesModule } from './policies/policies.module';
import { ScheduledTransactionsModule } from './scheduled-transactions/scheduled-transactions.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    KeysModule,
    TokenlistModule,
    ContactsModule,
    StablecoinsModule,
    PoliciesModule,
    ScheduledTransactionsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
