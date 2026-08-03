import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';
import { HealthService } from './health.service';

@AllowAnonymous()
@Controller('api/health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getHealth(@Res({ passthrough: true }) response: Response) {
    const health = await this.healthService.check();

    if (health.status !== 'ok') {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return health;
  }
}
