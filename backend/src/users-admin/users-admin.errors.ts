import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function throwIfUniqueConflict(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    const target = getPrismaErrorTarget(error.meta?.target);

    if (target.includes('email')) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'Пользователь с таким email уже существует.',
      });
    }

    if (target.includes('username')) {
      throw new ConflictException({
        code: 'USERNAME_ALREADY_EXISTS',
        message: 'Логин уже занят.',
      });
    }

    throw new ConflictException({
      code: 'UNIQUE_CONSTRAINT',
      message: 'Запись с такими данными уже существует.',
    });
  }
}

function getPrismaErrorTarget(target: unknown) {
  if (Array.isArray(target)) {
    return target.join(',');
  }

  return typeof target === 'string' ? target : '';
}

export function throwNotFoundIfPrismaError(error: unknown, code: string) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    throwUserAdminNotFound(code);
  }
}

export function throwUserAdminNotFound(code: string): never {
  throw new NotFoundException({
    code,
    message:
      code === 'USER_NOT_FOUND'
        ? 'Пользователь не найден.'
        : 'Сотрудник не найден.',
  });
}
