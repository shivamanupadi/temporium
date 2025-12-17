import { Controller, Get, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { LogsService } from './logs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LogEntry } from '@temporium/tempo-node-types';

@Controller('logs')
@UseGuards(JwtAuthGuard)
export class LogsController {
  constructor(private logsService: LogsService) {}

  /**
   * Get recent logs
   */
  @Get()
  async getLogs(
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number
  ): Promise<LogEntry[]> {
    return this.logsService.getLogs({ limit });
  }
}
