import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { Request } from 'express';
import { SetupService } from './setup.service';
import { parseCreateInitialAdminDto } from './setup.validation';
import type { CreateInitialAdminDto } from './setup.types';

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

@Controller('api/setup')
@AllowAnonymous()
export class SetupController {
  private readonly rateLimitBuckets = new Map<string, RateLimitBucket>();

  constructor(private readonly setupService: SetupService) {}

  @Get('status')
  getStatus() {
    return this.setupService.getStatus();
  }

  @Get('employees')
  listEmployees() {
    return this.setupService.listEmployees();
  }

  @Post('admin')
  createInitialAdmin(
    @Body() dto: CreateInitialAdminDto | undefined,
    @Req() request: Request,
  ) {
    this.assertAllowedOrigin(request);
    this.assertRateLimit(request);

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
    const frontendUrl = process.env.FRONTEND_URL?.trim();
    const allowedOrigins = new Set([
      frontendUrl,
      process.env.NODE_ENV !== 'production' ? 'http://127.0.0.1:5173' : null,
      process.env.NODE_ENV !== 'production' ? 'http://localhost:5173' : null,
    ]);

    if (!origin || !allowedOrigins.has(origin)) {
      throw new ForbiddenException({
        code: 'SETUP_INVALID_ORIGIN',
        message: 'Недопустимый источник запроса.',
      });
    }
  }

  private assertRateLimit(request: Request) {
    const now = Date.now();
    this.cleanupExpiredBuckets(now);

    const key = this.getRateLimitKey(request);

    if (!key) {
      this.throwRateLimited();
    }

    const current = this.rateLimitBuckets.get(key);

    if (!current || current.resetAt <= now) {
      this.rateLimitBuckets.set(key, {
        count: 1,
        resetAt: now + RATE_LIMIT_WINDOW_MS,
      });
      return;
    }

    current.count += 1;

    if (current.count > RATE_LIMIT_MAX_ATTEMPTS) {
      this.throwRateLimited();
    }
  }

  private cleanupExpiredBuckets(now: number) {
    for (const [key, bucket] of this.rateLimitBuckets) {
      if (bucket.resetAt <= now) {
        this.rateLimitBuckets.delete(key);
      }
    }
  }

  private getRateLimitKey(request: Request) {
    return request.ip || request.socket.remoteAddress || null;
  }

  private throwRateLimited(): never {
    throw new HttpException(
      {
        code: 'SETUP_RATE_LIMITED',
        message: 'Слишком много попыток. Попробуйте позже.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
