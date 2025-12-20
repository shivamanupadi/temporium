import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SystemService, SystemInfo, SystemRequirements } from './system.service';

@Controller('system')
export class SystemController {
  constructor(private systemService: SystemService) {}

  @Get('info')
  @UseGuards(JwtAuthGuard)
  async getSystemInfo(@Req() req: Request): Promise<SystemInfo> {
    // Extract host from request - strip port if present
    const host = (req.headers.host || 'localhost').split(':')[0];
    return this.systemService.getSystemInfo(host);
  }

  /**
   * Check system requirements (no authentication required)
   * Used during initial setup to verify minimum requirements
   */
  @Get('requirements')
  async checkRequirements(): Promise<SystemRequirements> {
    return this.systemService.checkRequirements();
  }
}
