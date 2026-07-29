import { Injectable } from '@nestjs/common';
import { EquipmentStatus } from '@prisma/client';
import { throwEventBadRequest } from '../events/events.errors';
import { parsePositiveInteger } from '../events/events.validation.parsers';
import type {
  EquipmentEventExtensionCreateInput,
  EquipmentEventExtensionUpdateInput,
} from './equipment-event-extension.command.types';
import { throwEquipmentEventExtensionBadRequest } from './equipment-event-extension.errors';

export function assertEquipmentAllowsActiveEvents(
  status: EquipmentStatus,
): void {
  if (status === EquipmentStatus.WRITTEN_OFF) {
    throwEquipmentEventExtensionBadRequest(
      'EQUIPMENT_WRITTEN_OFF',
      'Для списанного оборудования нельзя создавать или изменять активные события.',
    );
  }
}

@Injectable()
export class EquipmentEventExtensionValidation {
  assertNoLegacyFields(body: Record<string, unknown>): void {
    if (
      body.equipmentId !== undefined ||
      body.equipmentVisibleId !== undefined ||
      body.maintenanceTypeId !== undefined
    ) {
      throwEventBadRequest(
        'EVENT_EXTENSION_FIELDS_UNSUPPORTED',
        'Общий endpoint события не принимает поля расширения оборудования.',
      );
    }
  }

  parseCreateExtension(value: unknown): EquipmentEventExtensionCreateInput {
    if (!isPlainObject(value)) {
      throwEventBadRequest(
        'EVENT_EXTENSION_REQUIRED',
        'Для события оборудования передайте данные расширения.',
      );
    }

    assertKnownExtensionFields(value, [
      'equipmentVisibleId',
      'maintenanceTypeId',
    ]);

    return {
      equipmentVisibleId: parsePositiveInteger(
        value.equipmentVisibleId,
        'EQUIPMENT_INVALID',
        'Некорректный ID оборудования.',
      ),
      maintenanceTypeId: parsePositiveInteger(
        value.maintenanceTypeId,
        'MAINTENANCE_TYPE_REQUIRED',
        'Укажите вид обслуживания.',
      ),
    };
  }

  parseOptionalQueryPositiveInteger(
    value: unknown,
    code: string,
    message: string,
  ): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    return parsePositiveInteger(value, code, message);
  }

  parseUpdateExtension(value: unknown): EquipmentEventExtensionUpdateInput {
    if (!isPlainObject(value)) {
      throwEventBadRequest(
        'EVENT_EXTENSION_INVALID',
        'Некорректные данные расширения события.',
      );
    }

    assertKnownExtensionFields(value, [
      'equipmentVisibleId',
      'maintenanceTypeId',
    ]);

    return {
      ...(value.equipmentVisibleId !== undefined
        ? {
            equipmentVisibleId: parsePositiveInteger(
              value.equipmentVisibleId,
              'EQUIPMENT_INVALID',
              'Некорректный ID оборудования.',
            ),
          }
        : {}),
      ...(value.maintenanceTypeId !== undefined
        ? {
            maintenanceTypeId: parsePositiveInteger(
              value.maintenanceTypeId,
              'MAINTENANCE_TYPE_INVALID',
              'Некорректный вид обслуживания.',
            ),
          }
        : {}),
    };
  }
}

function assertKnownExtensionFields(
  value: Record<string, unknown>,
  allowedFields: string[],
): void {
  const allowedFieldSet = new Set(allowedFields);

  for (const fieldName of Object.keys(value)) {
    if (!allowedFieldSet.has(fieldName)) {
      throwEventBadRequest(
        'EVENT_EXTENSION_FIELD_UNSUPPORTED',
        'Расширение события содержит неподдерживаемое поле.',
      );
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
