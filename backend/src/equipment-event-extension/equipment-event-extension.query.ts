import { Injectable } from '@nestjs/common';
import { EventExtensionCode, Prisma } from '@prisma/client';
import type { EventExtensionPresenterRecord } from '../events/event-extensions/event-extension.adapter';
import {
  throwEventBadRequest,
  throwEventConflict,
} from '../events/events.errors';
import {
  equipmentEventExtensionDetailSelect,
  equipmentEventExtensionListSelect,
  type EquipmentEventExtensionDetailRecord,
  type EquipmentEventExtensionListRecord,
} from './equipment-event-extension.relations';
import { EquipmentEventExtensionValidation } from './equipment-event-extension.validation';

@Injectable()
export class EquipmentEventExtensionQuery {
  constructor(private readonly validation: EquipmentEventExtensionValidation) {}

  buildListWhere(params: {
    extensionCode: EventExtensionCode | null | undefined;
    query: Record<string, unknown>;
  }): Prisma.EventWhereInput | null {
    const equipmentVisibleId =
      this.validation.parseOptionalQueryPositiveInteger(
        params.query.equipmentVisibleId,
        'EQUIPMENT_INVALID',
        'Некорректный ID оборудования.',
      );
    const maintenanceTypeId = this.validation.parseOptionalQueryPositiveInteger(
      params.query.maintenanceTypeId,
      'MAINTENANCE_TYPE_INVALID',
      'Некорректный вид обслуживания.',
    );

    if (equipmentVisibleId === undefined && maintenanceTypeId === undefined) {
      return null;
    }

    if (params.extensionCode !== EventExtensionCode.EQUIPMENT) {
      throwEventBadRequest(
        'EVENT_EXTENSION_CODE_REQUIRED',
        'Фильтры оборудования доступны только для событий оборудования.',
      );
    }

    return {
      extensionCode: EventExtensionCode.EQUIPMENT,
      equipmentExtension: {
        is: {
          ...(equipmentVisibleId !== undefined
            ? { equipment: { visibleId: equipmentVisibleId } }
            : {}),
          ...(maintenanceTypeId !== undefined
            ? { eventTypeId: maintenanceTypeId }
            : {}),
        },
      },
    };
  }

  getDetailSelect(): Prisma.EventSelect {
    return {
      equipmentExtension: {
        select: equipmentEventExtensionDetailSelect,
      },
    };
  }

  getEquipmentExtension<
    TExtension extends
      EquipmentEventExtensionDetailRecord | EquipmentEventExtensionListRecord,
  >(event: EventExtensionPresenterRecord): TExtension {
    const extension = event.equipmentExtension;

    if (!extension) {
      throwEventConflict(
        'EVENT_EXTENSION_CONFLICT',
        'Расширение оборудования для события не найдено.',
      );
    }

    return extension as TExtension;
  }

  getListSelect(): Prisma.EventSelect {
    return {
      equipmentExtension: {
        select: equipmentEventExtensionListSelect,
      },
    };
  }

  hasExtensionRecord(event: EventExtensionPresenterRecord): boolean {
    return Boolean(event.equipmentExtension);
  }
}
