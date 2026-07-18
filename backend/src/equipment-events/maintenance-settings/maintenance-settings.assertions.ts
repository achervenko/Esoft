import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  maintenanceSettingSelect,
  maintenanceSettingsEquipmentSelect,
} from './maintenance-settings.relations';
import {
  throwMaintenanceSettingConflict,
  throwMaintenanceSettingBadRequest,
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

  async assertActiveMaintenanceType(
    tx: Prisma.TransactionClient,
    maintenanceTypeId: number,
  ) {
    const maintenanceType = await tx.equipmentEventType.findUnique({
      select: { id: true, isActive: true },
      where: { id: maintenanceTypeId },
    });

    if (!maintenanceType) {
      throwMaintenanceSettingNotFound(
        'MAINTENANCE_TYPE_NOT_FOUND',
        'Вид обслуживания не найден.',
      );
    }

    if (!maintenanceType.isActive) {
      throwMaintenanceSettingBadRequest(
        'MAINTENANCE_TYPE_INACTIVE',
        'Вид обслуживания отключён.',
      );
    }
  }

  async assertSettingDoesNotExist(
    tx: Prisma.TransactionClient,
    equipmentModelId: number,
    maintenanceTypeId: number,
  ) {
    const setting = await tx.equipmentMaintenanceSetting.findUnique({
      select: { id: true },
      where: {
        equipmentModelId_maintenanceTypeId: {
          equipmentModelId,
          maintenanceTypeId,
        },
      },
    });

    if (setting) {
      throwMaintenanceSettingConflict(
        'MAINTENANCE_SETTING_ALREADY_EXISTS',
        'Этот вид обслуживания уже настроен для модели оборудования.',
      );
    }
  }

  async assertSettingExists(
    tx: Prisma.TransactionClient,
    equipmentModelId: number,
    settingId: number,
  ) {
    const setting = await tx.equipmentMaintenanceSetting.findFirst({
      select: maintenanceSettingSelect,
      where: {
        equipmentModelId,
        id: settingId,
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

  async assertActiveChecklistTemplate(
    tx: Prisma.TransactionClient,
    checklistTemplateId: number,
  ) {
    const [checklistTemplate] = await tx.$queryRaw<
      Array<{ id: number; isActive: boolean; isPublished: boolean }>
    >`
      SELECT
        id,
        is_active AS "isActive",
        is_published AS "isPublished"
      FROM checklist_templates
      WHERE id = ${checklistTemplateId}
      FOR UPDATE
    `;

    if (!checklistTemplate) {
      throwMaintenanceSettingNotFound(
        'CHECKLIST_TEMPLATE_NOT_FOUND',
        'Шаблон чек-листа не найден.',
      );
    }

    if (!checklistTemplate.isActive || !checklistTemplate.isPublished) {
      throwMaintenanceSettingBadRequest(
        'CHECKLIST_TEMPLATE_INACTIVE',
        'Можно выбрать только активный шаблон чек-листа.',
      );
    }
  }
}
