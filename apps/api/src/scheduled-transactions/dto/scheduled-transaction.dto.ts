import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  Matches,
} from 'class-validator';

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

export enum TransactionStatus {
  PENDING = 'pending',
  EXECUTED = 'executed',
  FAILED = 'failed',
}

export class CreateScheduledTransactionDto {
  @IsString()
  @Matches(TX_HASH_REGEX, { message: 'Invalid transaction hash format' })
  txHash: string;

  @IsString()
  @Matches(ADDRESS_REGEX, { message: 'Invalid from address format' })
  from: string;

  @IsString()
  @Matches(ADDRESS_REGEX, { message: 'Invalid to address format' })
  to: string;

  @IsString()
  @IsNotEmpty()
  amount: string;

  @IsString()
  @Matches(ADDRESS_REGEX, { message: 'Invalid token address format' })
  token: string;

  @IsString()
  @IsNotEmpty()
  tokenSymbol: string;

  @IsNumber()
  tokenDecimals: number;

  @IsString()
  @Matches(ADDRESS_REGEX, { message: 'Invalid fee token address format' })
  feeToken: string;

  @IsString()
  @IsOptional()
  memo?: string;

  @IsDateString()
  scheduledFor: string;
}

export class UpdateScheduledTransactionDto {
  @IsEnum(TransactionStatus)
  status: TransactionStatus;

  @IsDateString()
  @IsOptional()
  executedAt?: string;
}

export class ScheduledTransactionResponseDto {
  id: string;
  owner: string;
  txHash: string;
  from: string;
  to: string;
  amount: string;
  token: string;
  tokenSymbol: string;
  tokenDecimals: number;
  feeToken: string;
  memo?: string;
  scheduledFor: Date;
  createdAt: Date;
  status: TransactionStatus;
  executedAt?: Date;
}
