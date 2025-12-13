import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'tollr-api' };
  }

  @Get()
  root() {
    return { status: 'ok', service: 'tollr-api', version: '1.0.0' };
  }
}
