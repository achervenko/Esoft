import { EventExtensionCode } from '@prisma/client';
import type {
  EquipmentEventExtensionCreateInput,
  EquipmentEventExtensionUpdateInput,
} from '../equipment-event-extension/equipment-event-extension.command.types';
import { throwEventBadRequest } from './events.errors';
import { parsePositiveInteger } from './events.validation.parsers';
import type {
  CreateEventDto,
  UpdateCreatedEventDto,
} from './events.validation.types';

export function assertNoLegacyExtensionFields(
  body: Pick<
    CreateEventDto,
    'equipmentId' | 'equipmentVisibleId' | 'maintenanceTypeId'
  >,
): void {
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

export function assertNoUpdateExtensionCode(
  value: UpdateCreatedEventDto['extensionCode'],
): void {
  if (value !== undefined) {
    throwEventBadRequest(
      'EVENT_EXTENSION_CODE_IMMUTABLE',
      'Тип расширения события нельзя изменить.',
    );
  }
}

export function parseCreateExtensionCode(
  value: CreateEventDto['extensionCode'],
): EventExtensionCode | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (value !== EventExtensionCode.EQUIPMENT) {
    throwEventBadRequest(
      'EVENT_EXTENSION_CODE_INVALID',
      'Некорректный тип расширения события.',
    );
  }

  return EventExtensionCode.EQUIPMENT;
}

export function parseCreateExtension(
  value: CreateEventDto['extension'],
  extensionCode: EventExtensionCode | null,
): EquipmentEventExtensionCreateInput | undefined {
  if (extensionCode === null) {
    if (value !== undefined) {
      throwEventBadRequest(
        'EVENT_EXTENSION_UNEXPECTED',
        'Для события без типа расширения нельзя передавать данные расширения.',
      );
    }

    return undefined;
  }

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

export function parseUpdateExtension(
  value: UpdateCreatedEventDto['extension'],
): EquipmentEventExtensionUpdateInput | undefined {
  if (value === undefined) {
    return undefined;
  }

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
