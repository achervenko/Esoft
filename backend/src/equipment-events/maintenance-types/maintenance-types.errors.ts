import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function throwMaintenanceTypeBadRequest(
  code: string,
  message: string,
): never {
  throw new BadRequestException({ code, message });
}

export function throwMaintenanceTypeConflict(
  code: string,
  message: string,
): never {
  throw new ConflictException({ code, message });
}

export function throwMaintenanceTypeNotFound(
  code = 'MAINTENANCE_TYPE_NOT_FOUND',
  message = 'Вид обслуживания не найден.',
): never {
  throw new NotFoundException({ code, message });
}

export function throwMaintenanceTypePrismaError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    const target = getPrismaErrorTarget(error);

    if (hasTarget(target, 'code', 'equipment_event_types_code')) {
      throwMaintenanceTypeConflict(
        'MAINTENANCE_TYPE_CODE_ALREADY_EXISTS',
        'Вид обслуживания с таким кодом уже существует.',
      );
    }

    if (hasTarget(target, 'name', 'equipment_event_types_name')) {
      throwMaintenanceTypeConflict(
        'MAINTENANCE_TYPE_NAME_ALREADY_EXISTS',
        'Вид обслуживания с таким названием уже существует.',
      );
    }
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    throwMaintenanceTypeNotFound();
  }

  throw error;
}

function getPrismaErrorTarget(
  error: Prisma.PrismaClientKnownRequestError,
): string[] {
  const target = error.meta?.target;

  if (Array.isArray(target)) {
    return target.filter((part): part is string => typeof part === 'string');
  }

  return typeof target === 'string' ? [target] : [];
}

function hasTarget(target: string[], ...needles: string[]) {
  const normalizedTarget = target.map((part) => part.toLowerCase());

  return needles.some((needle) => {
    const normalizedNeedle = needle.toLowerCase();

    return normalizedTarget.some((part) => part.includes(normalizedNeedle));
  });
}
