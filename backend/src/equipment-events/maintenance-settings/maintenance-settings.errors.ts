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

  if (hasTarget(target, 'code', 'equipment_event_types_code')) {
    throwMaintenanceSettingConflict(
      'EVENT_TYPE_CODE_ALREADY_EXISTS',
      'Тип события с таким кодом уже существует.',
    );
  }

  if (hasTarget(target, 'name', 'equipment_event_types_name')) {
    throwMaintenanceSettingConflict(
      'EVENT_TYPE_NAME_ALREADY_EXISTS',
      'Тип события с таким названием уже существует.',
    );
  }

  if (
    hasTarget(
      target,
      'equipmentModelId',
      'equipment_model_id',
      'pk_equipment_model_event_types',
    ) ||
    hasTarget(target, 'eventTypeId', 'event_type_id')
  ) {
    throwMaintenanceSettingConflict(
      'MAINTENANCE_SETTING_ALREADY_EXISTS',
      'Этот тип события уже назначен модели оборудования.',
    );
  }

  throwMaintenanceSettingConflict(
    'MAINTENANCE_SETTING_ALREADY_EXISTS',
    'Такая настройка или тип события уже существует.',
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
