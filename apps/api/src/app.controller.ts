import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok', service: 'tollr-api' };
  }

  @Get()
  root() {
    return { status: 'ok', service: 'tollr-api', version: '1.0.0' };
  }
}
