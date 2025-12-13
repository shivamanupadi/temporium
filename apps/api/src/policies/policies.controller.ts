import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PoliciesService } from './policies.service';
import { CreatePolicyDto, PolicyType } from './dto/policy.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('policies')
@UseGuards(JwtAuthGuard)
export class PoliciesController {
  constructor(private policiesService: PoliciesService) {}

  @Get()
  async findAll(
    @CurrentUser('walletAddress') owner: string,
    @Query('type') type?: PolicyType,
  ) {
    if (type) {
      return this.policiesService.findByType(owner, type);
    }
    return this.policiesService.findAll(owner);
  }

  @Get(':id')
  async findOne(
    @CurrentUser('walletAddress') owner: string,
    @Param('id') id: string,
  ) {
    return this.policiesService.findOne(owner, id);
  }

  @Post()
  async create(
    @CurrentUser('walletAddress') owner: string,
    @Body() dto: CreatePolicyDto,
  ) {
    return this.policiesService.create(owner, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentUser('walletAddress') owner: string,
    @Param('id') id: string,
  ) {
    return this.policiesService.remove(owner, id);
  }
}
