import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePolicyDto, PolicyType } from './dto/policy.dto';

@Injectable()
export class PoliciesService {
  constructor(private prisma: PrismaService) {}

  async findAll(owner: string) {
    return this.prisma.policy.findMany({
      where: { owner },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByType(owner: string, type: PolicyType) {
    return this.prisma.policy.findMany({
      where: { owner, type },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(owner: string, id: string) {
    const policy = await this.prisma.policy.findFirst({
      where: { id, owner },
    });

    if (!policy) {
      throw new NotFoundException('Policy not found');
    }

    return policy;
  }

  async findByPolicyId(owner: string, policyId: string) {
    return this.prisma.policy.findUnique({
      where: {
        owner_policyId: { owner, policyId },
      },
    });
  }

  async create(owner: string, dto: CreatePolicyDto) {
    try {
      return await this.prisma.policy.create({
        data: {
          owner,
          policyId: dto.policyId,
          type: dto.type,
          admin: dto.admin.toLowerCase(),
          txHash: dto.txHash?.toLowerCase(),
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'Policy with this ID already exists for this owner',
        );
      }
      throw error;
    }
  }

  async remove(owner: string, id: string) {
    const policy = await this.findOne(owner, id);

    await this.prisma.policy.delete({
      where: { id: policy.id },
    });

    return { success: true };
  }
}
