import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function throwIfUniqueConflict(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    const target = Array.isArray(error.meta?.target)
      ? error.meta.target.join(',')
      : String(error.meta?.target ?? '');

    if (target.includes('email')) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_EXISTS',
        message:
          '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u0441 \u0442\u0430\u043a\u0438\u043c email \u0443\u0436\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442.',
      });
    }

    if (target.includes('username')) {
      throw new ConflictException({
        code: 'USERNAME_ALREADY_EXISTS',
        message:
          '\u041b\u043e\u0433\u0438\u043d \u0443\u0436\u0435 \u0437\u0430\u043d\u044f\u0442.',
      });
    }

    throw new ConflictException({
      code: 'UNIQUE_CONSTRAINT',
      message:
        '\u0417\u0430\u043f\u0438\u0441\u044c \u0441 \u0442\u0430\u043a\u0438\u043c\u0438 \u0434\u0430\u043d\u043d\u044b\u043c\u0438 \u0443\u0436\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442.',
    });
  }
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
        ? '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d.'
        : '\u0421\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d.',
  });
}
