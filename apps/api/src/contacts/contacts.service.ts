import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';

@Injectable()
export class ContactsService {
  constructor(private prisma: PrismaService) {}

  async findAll(owner: string) {
    return this.prisma.contact.findMany({
      where: { owner },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(owner: string, id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, owner },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    return contact;
  }

  async findByAddress(owner: string, address: string) {
    return this.prisma.contact.findUnique({
      where: {
        owner_address: { owner, address },
      },
    });
  }

  async create(owner: string, dto: CreateContactDto) {
    try {
      return await this.prisma.contact.create({
        data: {
          owner,
          name: dto.name,
          address: dto.address.toLowerCase(),
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException('Contact with this address already exists');
      }
      throw error;
    }
  }

  async update(owner: string, id: string, dto: UpdateContactDto) {
    const contact = await this.findOne(owner, id);

    return this.prisma.contact.update({
      where: { id: contact.id },
      data: {
        name: dto.name,
      },
    });
  }

  async remove(owner: string, id: string) {
    const contact = await this.findOne(owner, id);

    await this.prisma.contact.delete({
      where: { id: contact.id },
    });

    return { success: true };
  }
}
