import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

export function stockError(
  status: 400 | 404 | 409,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): never {
  const body = { code, message, ...(details ? { details } : {}) };
  if (status === 400) throw new BadRequestException(body);
  if (status === 404) throw new NotFoundException(body);
  throw new ConflictException(body);
}
