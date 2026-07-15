import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function throwMaintenanceSettingBadRequest(
  code: string,
  message: string,
): never {
  throw new BadRequestException({ code, message });
}

export function throwMaintenanceSettingConflict(
  code: string,
  message: string,
): never {
  throw new ConflictException({ code, message });
}

export function throwMaintenanceSettingNotFound(
  code: string,
  message: string,
): never {
  throw new NotFoundException({ code, message });
}

export function throwMaintenanceSettingPrismaError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throwMaintenanceSettingUniqueConflict(error);
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    throwMaintenanceSettingNotFound(
      'MAINTENANCE_SETTING_NOT_FOUND',
      'Настройка обслуживания не найдена.',
    );
  }

  throw error;
}

function throwMaintenanceSettingUniqueConflict(
  error: Prisma.PrismaClientKnownRequestError,
): never {
  const target = getPrismaErrorTarget(error);

  if (
    hasTarget(
      target,
      'equipmentModelId',
      'equipment_model_id',
      'uq_equipment_maintenance_settings_model_type',
    ) ||
    hasTarget(target, 'maintenanceTypeId', 'maintenance_type_id')
  ) {
    throwMaintenanceSettingConflict(
      'MAINTENANCE_SETTING_ALREADY_EXISTS',
      'Этот вид обслуживания уже настроен для модели оборудования.',
    );
  }

  throwMaintenanceSettingConflict(
    'MAINTENANCE_SETTING_ALREADY_EXISTS',
    'Такая настройка или вид обслуживания уже существует.',
  );
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
