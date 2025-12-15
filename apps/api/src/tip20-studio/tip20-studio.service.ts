import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTip20ContractDto } from './dto/tip20-contract.dto';

@Injectable()
export class Tip20StudioService {
  constructor(private prisma: PrismaService) {}

  async findAll(owner: string) {
    return this.prisma.tip20Contract.findMany({
      where: { owner },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(owner: string, id: string) {
    const contract = await this.prisma.tip20Contract.findFirst({
      where: { id, owner },
    });

    if (!contract) {
      throw new NotFoundException('TIP-20 contract not found');
    }

    return contract;
  }

  async findByAddress(owner: string, address: string) {
    return this.prisma.tip20Contract.findUnique({
      where: {
        owner_address: { owner, address },
      },
    });
  }

  async create(owner: string, dto: CreateTip20ContractDto) {
    try {
      return await this.prisma.tip20Contract.create({
        data: {
          owner,
          address: dto.address.toLowerCase(),
          name: dto.name,
          symbol: dto.symbol,
          currency: dto.currency,
          creator: dto.creator.toLowerCase(),
          txHash: dto.txHash?.toLowerCase(),
        },
      });
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        throw new ConflictException(
          'TIP-20 contract with this address already exists for this owner',
        );
      }
      throw error;
    }
  }

  async remove(owner: string, id: string) {
    const contract = await this.findOne(owner, id);

    await this.prisma.tip20Contract.delete({
      where: { id: contract.id },
    });

    return { success: true };
  }
}
