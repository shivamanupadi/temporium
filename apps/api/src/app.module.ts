import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { KeysModule } from './keys/keys.module';
import { ContactsModule } from './contacts/contacts.module';
import { StablecoinsModule } from './stablecoins/stablecoins.module';
import { PoliciesModule } from './policies/policies.module';
import { ScheduledTransactionsModule } from './scheduled-transactions/scheduled-transactions.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    KeysModule,
    ContactsModule,
    StablecoinsModule,
    PoliciesModule,
    ScheduledTransactionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
