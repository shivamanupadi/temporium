import { Controller, Get } from '@nestjs/common';

@Controller({ version: '' })
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok', service: 'temporium-api' };
  }

  @Get()
  root() {
    return { status: 'ok', service: 'temporium-api', version: '1.0.0' };
  }
}
