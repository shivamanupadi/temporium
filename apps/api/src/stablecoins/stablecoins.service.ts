import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStablecoinDto } from './dto/stablecoin.dto';

@Injectable()
export class StablecoinsService {
  constructor(private prisma: PrismaService) {}

  async findAll(owner: string) {
    return this.prisma.stablecoin.findMany({
      where: { owner },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(owner: string, id: string) {
    const stablecoin = await this.prisma.stablecoin.findFirst({
      where: { id, owner },
    });

    if (!stablecoin) {
      throw new NotFoundException('Stablecoin not found');
    }

    return stablecoin;
  }

  async findByAddress(owner: string, address: string) {
    return this.prisma.stablecoin.findUnique({
      where: {
        owner_address: { owner, address },
      },
    });
  }

  async create(owner: string, dto: CreateStablecoinDto) {
    try {
      return await this.prisma.stablecoin.create({
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
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'Stablecoin with this address already exists for this owner',
        );
      }
      throw error;
    }
  }

  async remove(owner: string, id: string) {
    const stablecoin = await this.findOne(owner, id);

    await this.prisma.stablecoin.delete({
      where: { id: stablecoin.id },
    });

    return { success: true };
  }
}
