import { Controller, Get, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { UpdateService, VersionInfo, UpdateResult } from './update.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('update')
export class UpdateController {
  constructor(private updateService: UpdateService) {}

  /**
   * Get current version (no auth required for display)
   */
  @Get('version')
  async getCurrentVersion(): Promise<{ version: string }> {
    return { version: this.updateService.getCurrentVersion() };
  }

  /**
   * Check for updates (requires auth)
   */
  @Get('check')
  @UseGuards(JwtAuthGuard)
  async checkForUpdates(): Promise<VersionInfo> {
    return this.updateService.getVersionInfo();
  }

  /**
   * Perform update (requires auth)
   */
  @Post('install')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async installUpdate(): Promise<UpdateResult> {
    return this.updateService.performUpdate();
  }

  /**
   * Restart service after update (requires auth)
   */
  @Post('restart')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async restartService(): Promise<{ success: boolean; message: string }> {
    return this.updateService.restartService();
  }
}
