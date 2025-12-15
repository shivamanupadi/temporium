import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { Tip20StudioService } from './tip20-studio.service';
import { CreateTip20ContractDto } from './dto/tip20-contract.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller({ path: 'tip20-contracts', version: '1' })
@UseGuards(JwtAuthGuard)
export class Tip20StudioController {
  constructor(private tip20StudioService: Tip20StudioService) {}

  @Get()
  async findAll(@CurrentUser('walletAddress') owner: string) {
    return this.tip20StudioService.findAll(owner);
  }

  @Get(':id')
  async findOne(
    @CurrentUser('walletAddress') owner: string,
    @Param('id') id: string,
  ) {
    return this.tip20StudioService.findOne(owner, id);
  }

  @Post()
  async create(
    @CurrentUser('walletAddress') owner: string,
    @Body() dto: CreateTip20ContractDto,
  ) {
    return this.tip20StudioService.create(owner, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentUser('walletAddress') owner: string,
    @Param('id') id: string,
  ) {
    return this.tip20StudioService.remove(owner, id);
  }
}
