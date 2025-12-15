import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';

// Ethereum address regex (0x followed by 40 hex characters)
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export class CreateContactDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @Matches(ADDRESS_REGEX, { message: 'Invalid wallet address format' })
  address: string;
}

export class UpdateContactDto {
  @IsString()
  @IsOptional()
  name?: string;
}

export class ContactResponseDto {
  id: string;
  owner: string;
  name: string;
  address: string;
  createdAt: Date;
  updatedAt: Date;
}
