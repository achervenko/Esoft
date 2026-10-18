import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { Request } from 'express';
import { getFrontendOrigins } from '../config/frontend-origins';
import { loadRootConfig } from '../config/root-environment';
import { SetupRateLimitService } from './setup-rate-limit.service';
import { SetupService } from './setup.service';
import { parseCreateInitialAdminDto } from './setup.validation';
import type { CreateInitialAdminDto } from './setup.types';

const config = loadRootConfig();
const allowedOrigins = new Set(getFrontendOrigins(config));

@Controller('api/setup')
export class SetupController {
  constructor(
    private readonly setupService: SetupService,
    private readonly rateLimit: SetupRateLimitService,
  ) {}

  @Get('status')
  @AllowAnonymous()
  getStatus() {
    return this.setupService.getStatus();
  }

  @Get('employees')
  @AllowAnonymous()
  listEmployees() {
    return this.setupService.listEmployees();
  }

  @Post('admin')
  @AllowAnonymous()
  async createInitialAdmin(
    @Body() dto: CreateInitialAdminDto | undefined,
    @Req() request: Request,
  ) {
    this.assertAllowedOrigin(request);
    await this.rateLimit.consume(request.ip || request.socket.remoteAddress);

    return this.setupService.createInitialAdmin(
      parseCreateInitialAdminDto(dto),
      {
        ipAddress: request.ip,
        origin: request.get('origin') ?? null,
        userAgent: request.get('user-agent') ?? null,
      },
    );
  }

  private assertAllowedOrigin(request: Request) {
    const origin = request.get('origin');

    if (!origin || !allowedOrigins.has(origin)) {
      throw new ForbiddenException({
        code: 'SETUP_INVALID_ORIGIN',
        message: 'Недопустимый источник запроса.',
      });
    }
  }
}
