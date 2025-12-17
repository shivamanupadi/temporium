import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  Res,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { MetricsService } from './metrics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SystemMetrics, MetricsDataPoint } from '@temporium/tempo-node-types';

@Controller('metrics')
export class MetricsController {
  constructor(private metricsService: MetricsService) {}

  /**
   * Prometheus metrics endpoint (no auth required for scraping)
   * Access at: /api/metrics/prometheus
   */
  @Get('prometheus')
  async getPrometheusMetrics(@Res() reply: FastifyReply): Promise<void> {
    const metrics = await this.metricsService.getPrometheusMetrics();
    reply.header('Content-Type', this.metricsService.getPrometheusContentType());
    reply.send(metrics);
  }

  /**
   * Get current system metrics (requires auth)
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getCurrentMetrics(): Promise<SystemMetrics> {
    return this.metricsService.getCurrentMetrics();
  }

  /**
   * Get metrics history for charts (requires auth)
   */
  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getHistory(
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
  ): Promise<MetricsDataPoint[]> {
    return this.metricsService.getHistory(limit);
  }
}
