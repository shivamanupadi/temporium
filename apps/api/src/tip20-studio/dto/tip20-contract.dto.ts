import {
  IsString,
  IsNotEmpty,
  Matches,
  ValidateIf,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
// Accept valid tx hash (0x + 64 hex chars) OR 'imported' for imported tokens
const TX_HASH_REGEX = /^(0x[a-fA-F0-9]{64}|imported)$/;

export class CreateTip20ContractDto {
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

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === '' ? undefined : value,
  )
  @ValidateIf(
    (_, value) => value !== undefined && value !== null && value !== '',
  )
  @IsString()
  @Matches(TX_HASH_REGEX, { message: 'Invalid transaction hash format' })
  txHash?: string;
}

export class Tip20ContractResponseDto {
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
