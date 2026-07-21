import {
  BadRequestException,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function throwSetupAlreadyCompleted(): never {
  throw new ConflictException({
    code: 'SETUP_ALREADY_COMPLETED',
    message: 'Первоначальная настройка уже завершена.',
  });
}

export function throwSetupInvalidPayload(
  message = 'Проверьте данные формы.',
): never {
  throw new BadRequestException({
    code: 'SETUP_INVALID_PAYLOAD',
    message,
  });
}

export function throwSetupPasswordTooWeak(): never {
  throw new BadRequestException({
    code: 'SETUP_PASSWORD_TOO_WEAK',
    message: 'Пароль не соответствует требованиям безопасности.',
  });
}

export function throwSetupPasswordConfirmationMismatch(): never {
  throw new BadRequestException({
    code: 'SETUP_PASSWORD_CONFIRMATION_MISMATCH',
    message: 'Пароли не совпадают.',
  });
}

export function throwSetupEmployeeNotFound(): never {
  throw new NotFoundException({
    code: 'SETUP_EMPLOYEE_NOT_FOUND',
    message: 'Сотрудник не найден.',
  });
}

export function throwSetupEmployeeInactive(): never {
  throw new BadRequestException({
    code: 'SETUP_EMPLOYEE_INACTIVE',
    message: 'Нельзя создать учётную запись для отключённого сотрудника.',
  });
}

export function throwSetupEmailAlreadyExists(): never {
  throw new ConflictException({
    code: 'SETUP_EMAIL_ALREADY_EXISTS',
    message: 'Пользователь с таким email уже существует.',
  });
}

export function throwSetupUsernameAlreadyExists(): never {
  throw new ConflictException({
    code: 'SETUP_USERNAME_ALREADY_EXISTS',
    message: 'Пользователь с таким логином уже существует.',
  });
}

export function throwSetupCreationFailed(): never {
  throw new InternalServerErrorException({
    code: 'SETUP_CREATION_FAILED',
    message: 'Не удалось завершить первоначальную настройку.',
  });
}

export function translateSetupPrismaError(error: unknown): never {
  if (error instanceof HttpException) {
    throw error;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    const target = getPrismaTarget(error.meta?.target);

    if (hasAnyTarget(target, ['email', 'user_email_key'])) {
      throwSetupEmailAlreadyExists();
    }

    if (hasAnyTarget(target, ['username', 'user_username_key'])) {
      throwSetupUsernameAlreadyExists();
    }
  }

  throwSetupCreationFailed();
}

function getPrismaTarget(target: unknown) {
  if (Array.isArray(target)) {
    return target.filter((value): value is string => typeof value === 'string');
  }

  return typeof target === 'string' ? [target] : [];
}

function hasAnyTarget(target: string[], values: string[]) {
  return values.some((value) =>
    target.some((item) => item === value || item.includes(value)),
  );
}
