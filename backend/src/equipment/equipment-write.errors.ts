import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function throwVisibleIdConflict(): never {
  throw new ConflictException({
    code: 'EQUIPMENT_ID_ALREADY_EXISTS',
    message: 'Оборудование с таким ID уже существует.',
  });
}

export function throwInventoryNumberConflict(): never {
  throw new ConflictException({
    code: 'EQUIPMENT_INVENTORY_NUMBER_ALREADY_EXISTS',
    message: 'Оборудование с таким инвентарным номером уже существует.',
  });
}

export function throwIfEquipmentUniqueConflict(error: unknown) {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return;
  }

  const target = getUniqueConflictTarget(error.meta?.target);

  if (
    hasAnyTarget(target, [
      'visible_id',
      'visibleId',
      'equipment_visible_id_key',
    ])
  ) {
    throwVisibleIdConflict();
  }

  if (
    hasAnyTarget(target, [
      'inventory_number',
      'inventoryNumber',
      'equipment_inventory_number_key',
    ])
  ) {
    throwInventoryNumberConflict();
  }
}

function getUniqueConflictTarget(target: unknown) {
  if (Array.isArray(target)) {
    return target.filter((item): item is string => typeof item === 'string');
  }

  return typeof target === 'string' ? [target] : [];
}

function hasAnyTarget(target: string[], values: string[]) {
  return values.some((value) => target.includes(value));
}
