import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
