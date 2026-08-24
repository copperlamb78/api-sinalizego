import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Health Check & Disponibilidade')
@SkipThrottle()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @ApiOperation({
    summary: 'Health Check da API',
    description:
      'Retorna o estado de disponibilidade, uptime e timestamp da aplicação (Público, sem autenticação).',
  })
  @ApiResponse({
    status: 200,
    description: 'API online e operacional.',
    schema: {
      example: {
        status: 'ok',
        uptime: 123.45,
        timestamp: '2026-08-23T22:00:00.000Z',
      },
    },
  })
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}

