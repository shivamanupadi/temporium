import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller({ path: 'contacts', version: '1' })
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(private contactsService: ContactsService) {}

  @Get()
  async findAll(@CurrentUser('walletAddress') owner: string) {
    return this.contactsService.findAll(owner);
  }

  @Get(':id')
  async findOne(
    @CurrentUser('walletAddress') owner: string,
    @Param('id') id: string,
  ) {
    return this.contactsService.findOne(owner, id);
  }

  @Post()
  async create(
    @CurrentUser('walletAddress') owner: string,
    @Body() dto: CreateContactDto,
  ) {
    return this.contactsService.create(owner, dto);
  }

  @Patch(':id')
  async update(
    @CurrentUser('walletAddress') owner: string,
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactsService.update(owner, id, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentUser('walletAddress') owner: string,
    @Param('id') id: string,
  ) {
    return this.contactsService.remove(owner, id);
  }
}
