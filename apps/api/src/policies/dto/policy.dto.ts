import { IsString, IsNotEmpty, IsOptional, IsEnum, Matches } from 'class-validator';

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

export enum PolicyType {
  WHITELIST = 'whitelist',
  BLACKLIST = 'blacklist',
}

export class CreatePolicyDto {
  @IsString()
  @IsNotEmpty()
  policyId: string;

  @IsEnum(PolicyType)
  type: PolicyType;

  @IsString()
  @Matches(ADDRESS_REGEX, { message: 'Invalid admin address format' })
  admin: string;

  @IsString()
  @IsOptional()
  @Matches(TX_HASH_REGEX, { message: 'Invalid transaction hash format' })
  txHash?: string;
}

export class PolicyResponseDto {
  id: string;
  owner: string;
  policyId: string;
  type: PolicyType;
  admin: string;
  txHash?: string;
  createdAt: Date;
}
