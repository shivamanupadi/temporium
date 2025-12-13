import { IsString, IsNotEmpty, Matches } from 'class-validator';

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

export class CreateStablecoinDto {
  @IsString()
  @Matches(ADDRESS_REGEX, { message: 'Invalid token address format' })
  address: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  symbol: string;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsString()
  @Matches(ADDRESS_REGEX, { message: 'Invalid creator address format' })
  creator: string;

  @IsString()
  @Matches(TX_HASH_REGEX, { message: 'Invalid transaction hash format' })
  txHash: string;
}

export class StablecoinResponseDto {
  id: string;
  owner: string;
  address: string;
  name: string;
  symbol: string;
  currency: string;
  creator: string;
  txHash: string;
  createdAt: Date;
}
