import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  maintenanceSettingSelect,
  maintenanceSettingsEquipmentSelect,
} from './maintenance-settings.relations';
import {
  throwMaintenanceSettingConflict,
  throwMaintenanceSettingNotFound,
} from './maintenance-settings.errors';

@Injectable()
export class MaintenanceSettingsAssertions {
  async loadEquipmentByVisibleId(
    tx: Prisma.TransactionClient,
    visibleId: number,
  ) {
    const equipment = await tx.equipment.findUnique({
      select: maintenanceSettingsEquipmentSelect,
      where: { visibleId },
    });

    if (!equipment) {
      throwMaintenanceSettingNotFound(
        'EQUIPMENT_NOT_FOUND',
        'Оборудование не найдено.',
      );
    }

    return equipment;
  }

  async assertActiveEventType(tx: Prisma.TransactionClient, eventTypeId: number) {
    const eventType = await tx.equipmentEventType.findUnique({
      select: { id: true, isActive: true },
      where: { id: eventTypeId },
    });

    if (!eventType || !eventType.isActive) {
      throwMaintenanceSettingNotFound(
        'EVENT_TYPE_NOT_FOUND',
        'Активный тип события не найден.',
      );
    }
  }

  async assertSettingDoesNotExist(
    tx: Prisma.TransactionClient,
    equipmentModelId: number,
    eventTypeId: number,
  ) {
    const setting = await tx.equipmentModelEventType.findUnique({
      select: { eventTypeId: true },
      where: {
        equipmentModelId_eventTypeId: {
          equipmentModelId,
          eventTypeId,
        },
      },
    });

    if (setting) {
      throwMaintenanceSettingConflict(
        'MAINTENANCE_SETTING_ALREADY_EXISTS',
        'Этот тип события уже назначен модели оборудования.',
      );
    }
  }

  async assertSettingExists(
    tx: Prisma.TransactionClient,
    equipmentModelId: number,
    eventTypeId: number,
  ) {
    const setting = await tx.equipmentModelEventType.findUnique({
      select: maintenanceSettingSelect,
      where: {
        equipmentModelId_eventTypeId: {
          equipmentModelId,
          eventTypeId,
        },
      },
    });

    if (!setting) {
      throwMaintenanceSettingNotFound(
        'MAINTENANCE_SETTING_NOT_FOUND',
        'Настройка обслуживания не найдена.',
      );
    }

    return setting;
  }

  async assertEventTypeCodeAndNameAreFree(
    tx: Prisma.TransactionClient,
    code: string,
    name: string,
  ) {
    const eventType = await tx.equipmentEventType.findFirst({
      select: { id: true },
      where: {
        OR: [{ code }, { name }],
      },
    });

    if (eventType) {
      throwMaintenanceSettingConflict(
        'EVENT_TYPE_ALREADY_EXISTS',
        'Тип события с таким названием или кодом уже существует.',
      );
    }
  }
}
