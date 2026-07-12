import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function throwDictionaryPrismaError(
  error: unknown,
  notFoundCode: string,
): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new ConflictException({
      code: 'DICTIONARY_ITEM_ALREADY_EXISTS',
      message: 'Такая запись уже существует.',
    });
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2003'
  ) {
    throw new BadRequestException({
      code: 'DICTIONARY_ITEM_IN_USE',
      message: 'Запись используется в системе. Удаление недоступно.',
    });
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    throw new NotFoundException({
      code: notFoundCode,
      message: 'Запись не найдена.',
    });
  }

  throw error;
}
