import {
  Controller,
  Get,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MonitoringService, MonitoringStatus } from './monitoring.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('monitoring')
@UseGuards(JwtAuthGuard)
export class MonitoringController {
  constructor(private monitoringService: MonitoringService) {}

  /**
   * Get monitoring stack status
   */
  @Get('status')
  async getStatus(): Promise<MonitoringStatus> {
    return this.monitoringService.getStatus();
  }

  /**
   * Start Prometheus + Grafana
   */
  @Post('start')
  @HttpCode(HttpStatus.OK)
  async startMonitoring(): Promise<{ success: boolean; message: string }> {
    return this.monitoringService.startMonitoring();
  }

  /**
   * Stop Prometheus + Grafana
   */
  @Post('stop')
  @HttpCode(HttpStatus.OK)
  async stopMonitoring(): Promise<{ success: boolean; message: string }> {
    return this.monitoringService.stopMonitoring();
  }
}
