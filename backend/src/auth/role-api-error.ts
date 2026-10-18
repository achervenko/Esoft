import { BadRequestException } from '@nestjs/common';
import { APIError } from 'better-auth/api';

export function rethrowRoleApiError(error: unknown): never {
  if (!(error instanceof BadRequestException)) throw error;
  throw new APIError(
    'BAD_REQUEST',
    error.getResponse() as { code: string; message: string },
  );
}
