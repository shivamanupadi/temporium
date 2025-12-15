import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ScheduledTransactionsService } from './scheduled-transactions.service';
import {
  CreateScheduledTransactionDto,
  UpdateScheduledTransactionDto,
  TransactionStatus,
} from './dto/scheduled-transaction.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller({ path: 'scheduled-transactions', version: '1' })
@UseGuards(JwtAuthGuard)
export class ScheduledTransactionsController {
  constructor(
    private scheduledTransactionsService: ScheduledTransactionsService,
  ) {}

  @Get()
  async findAll(
    @CurrentUser('walletAddress') owner: string,
    @Query('status') status?: TransactionStatus,
  ) {
    if (status) {
      return this.scheduledTransactionsService.findByStatus(owner, status);
    }
    return this.scheduledTransactionsService.findAll(owner);
  }

  @Get('pending')
  async findPending(@CurrentUser('walletAddress') owner: string) {
    return this.scheduledTransactionsService.findPending(owner);
  }

  @Get(':id')
  async findOne(
    @CurrentUser('walletAddress') owner: string,
    @Param('id') id: string,
  ) {
    return this.scheduledTransactionsService.findOne(owner, id);
  }

  @Post()
  async create(
    @CurrentUser('walletAddress') owner: string,
    @Body() dto: CreateScheduledTransactionDto,
  ) {
    return this.scheduledTransactionsService.create(owner, dto);
  }

  @Patch(':id')
  async update(
    @CurrentUser('walletAddress') owner: string,
    @Param('id') id: string,
    @Body() dto: UpdateScheduledTransactionDto,
  ) {
    return this.scheduledTransactionsService.update(owner, id, dto);
  }

  @Patch(':id/execute')
  async markExecuted(
    @CurrentUser('walletAddress') owner: string,
    @Param('id') id: string,
  ) {
    return this.scheduledTransactionsService.markExecuted(owner, id);
  }

  @Patch(':id/fail')
  async markFailed(
    @CurrentUser('walletAddress') owner: string,
    @Param('id') id: string,
  ) {
    return this.scheduledTransactionsService.markFailed(owner, id);
  }

  @Delete(':id')
  async remove(
    @CurrentUser('walletAddress') owner: string,
    @Param('id') id: string,
  ) {
    return this.scheduledTransactionsService.remove(owner, id);
  }
}
