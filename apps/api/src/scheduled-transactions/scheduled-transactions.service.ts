import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateScheduledTransactionDto,
  UpdateScheduledTransactionDto,
  TransactionStatus,
} from './dto/scheduled-transaction.dto';

@Injectable()
export class ScheduledTransactionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(owner: string) {
    return this.prisma.scheduledTransaction.findMany({
      where: { owner },
      orderBy: { scheduledFor: 'asc' },
    });
  }

  async findByStatus(owner: string, status: TransactionStatus) {
    return this.prisma.scheduledTransaction.findMany({
      where: { owner, status },
      orderBy: { scheduledFor: 'asc' },
    });
  }

  async findPending(owner: string) {
    return this.findByStatus(owner, TransactionStatus.PENDING);
  }

  async findOne(owner: string, id: string) {
    const transaction = await this.prisma.scheduledTransaction.findFirst({
      where: { id, owner },
    });

    if (!transaction) {
      throw new NotFoundException('Scheduled transaction not found');
    }

    return transaction;
  }

  async create(owner: string, dto: CreateScheduledTransactionDto) {
    return this.prisma.scheduledTransaction.create({
      data: {
        owner,
        txHash: dto.txHash.toLowerCase(),
        from: dto.from.toLowerCase(),
        to: dto.to.toLowerCase(),
        amount: dto.amount,
        token: dto.token.toLowerCase(),
        tokenSymbol: dto.tokenSymbol,
        tokenDecimals: dto.tokenDecimals,
        feeToken: dto.feeToken.toLowerCase(),
        memo: dto.memo,
        scheduledFor: new Date(dto.scheduledFor),
      },
    });
  }

  async update(owner: string, id: string, dto: UpdateScheduledTransactionDto) {
    const transaction = await this.findOne(owner, id);

    return this.prisma.scheduledTransaction.update({
      where: { id: transaction.id },
      data: {
        status: dto.status,
        executedAt: dto.executedAt ? new Date(dto.executedAt) : undefined,
      },
    });
  }

  async markExecuted(owner: string, id: string) {
    return this.update(owner, id, {
      status: TransactionStatus.EXECUTED,
      executedAt: new Date().toISOString(),
    });
  }

  async markFailed(owner: string, id: string) {
    return this.update(owner, id, {
      status: TransactionStatus.FAILED,
    });
  }

  async remove(owner: string, id: string) {
    const transaction = await this.findOne(owner, id);

    await this.prisma.scheduledTransaction.delete({
      where: { id: transaction.id },
    });

    return { success: true };
  }
}
