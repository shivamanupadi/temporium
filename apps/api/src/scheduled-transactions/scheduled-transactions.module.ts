import { Module } from '@nestjs/common';
import { ScheduledTransactionsController } from './scheduled-transactions.controller';
import { ScheduledTransactionsService } from './scheduled-transactions.service';

@Module({
  controllers: [ScheduledTransactionsController],
  providers: [ScheduledTransactionsService],
  exports: [ScheduledTransactionsService],
})
export class ScheduledTransactionsModule {}
