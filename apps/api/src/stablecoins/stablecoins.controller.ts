import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { StablecoinsService } from './stablecoins.service';
import { CreateStablecoinDto } from './dto/stablecoin.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('stablecoins')
@UseGuards(JwtAuthGuard)
export class StablecoinsController {
  constructor(private stablecoinsService: StablecoinsService) {}

  @Get()
  async findAll(@CurrentUser('walletAddress') owner: string) {
    return this.stablecoinsService.findAll(owner);
  }

  @Get(':id')
  async findOne(
    @CurrentUser('walletAddress') owner: string,
    @Param('id') id: string,
  ) {
    return this.stablecoinsService.findOne(owner, id);
  }

  @Post()
  async create(
    @CurrentUser('walletAddress') owner: string,
    @Body() dto: CreateStablecoinDto,
  ) {
    return this.stablecoinsService.create(owner, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentUser('walletAddress') owner: string,
    @Param('id') id: string,
  ) {
    return this.stablecoinsService.remove(owner, id);
  }
}
