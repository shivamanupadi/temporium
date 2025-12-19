import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SystemService, SystemInfo } from './system.service';

@Controller('system')
@UseGuards(JwtAuthGuard)
export class SystemController {
  constructor(private systemService: SystemService) {}

  @Get('info')
  async getSystemInfo(@Req() req: Request): Promise<SystemInfo> {
    // Extract host from request - strip port if present
    const host = (req.headers.host || 'localhost').split(':')[0];
    return this.systemService.getSystemInfo(host);
  }
}
