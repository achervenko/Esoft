import { Injectable } from '@nestjs/common';
import {
  EquipmentStatus,
  type EquipmentMaintenanceExecutionType,
  Prisma,
} from '@prisma/client';
import {
  throwEquipmentEventExtensionBadRequest,
  throwEquipmentEventExtensionNotFound,
} from './equipment-event-extension.errors';
import { assertEquipmentAllowsActiveEvents } from './equipment-event-extension.validation';

@Injectable()
export class EquipmentEventExtensionInputLoader {
  async loadActiveApplicableMaintenanceSetting(
    tx: Prisma.TransactionClient,
    params: {
      equipmentModelId: number;
      maintenanceTypeId: number;
    },
  ) {
    const eventTypes = await tx.$queryRaw<
      Array<{
        id: number;
        is_active: boolean;
      }>
    >`
      SELECT id, is_active
      FROM equipment_event_types
      WHERE id = ${params.maintenanceTypeId}
      FOR SHARE
    `;
    const eventType = eventTypes[0];

    if (!eventType) {
      throwEquipmentEventExtensionNotFound(
        'MAINTENANCE_TYPE_NOT_FOUND',
        'Вид обслуживания не найден.',
      );
    }

    if (!eventType.is_active) {
      throwEquipmentEventExtensionBadRequest(
        'MAINTENANCE_TYPE_INACTIVE',
        'Вид обслуживания отключён.',
      );
    }

    const maintenanceSettings = await tx.$queryRaw<
      Array<{
        execution_type: EquipmentMaintenanceExecutionType;
        id: number;
      }>
    >`
      SELECT id, execution_type
      FROM equipment_maintenance_settings
      WHERE equipment_model_id = ${params.equipmentModelId}
        AND maintenance_type_id = ${params.maintenanceTypeId}
      FOR SHARE
    `;
    const maintenanceSetting = maintenanceSettings[0];

    if (!maintenanceSetting) {
      throwEquipmentEventExtensionBadRequest(
        'MAINTENANCE_SETTING_NOT_FOUND',
        'Настройка обслуживания для этого вида не найдена.',
      );
    }

    return {
      executionType: maintenanceSetting.execution_type,
      id: maintenanceSetting.id,
    };
  }

  async loadAndLockEquipmentByVisibleId(
    tx: Prisma.TransactionClient,
    visibleId: number,
  ) {
    const rows = await tx.$queryRaw<
      Array<{
        id: number;
        model_id: number;
        status: EquipmentStatus;
      }>
    >`
      SELECT id, model_id, status
      FROM equipment
      WHERE visible_id = ${visibleId}
      FOR SHARE
    `;
    const equipment = rows[0];

    if (!equipment) {
      throwEquipmentEventExtensionNotFound(
        'EQUIPMENT_NOT_FOUND',
        'Оборудование не найдено.',
      );
    }

    assertEquipmentAllowsActiveEvents(equipment.status);

    return {
      id: equipment.id,
      modelId: equipment.model_id,
    };
  }

  async loadAndLockEquipmentById(
    tx: Prisma.TransactionClient,
    equipmentId: number,
  ) {
    const rows = await tx.$queryRaw<
      Array<{
        id: number;
        model_id: number;
        status: EquipmentStatus;
      }>
    >`
      SELECT id, model_id, status
      FROM equipment
      WHERE id = ${equipmentId}
      FOR SHARE
    `;
    const equipment = rows[0];

    if (!equipment) {
      throwEquipmentEventExtensionNotFound(
        'EQUIPMENT_NOT_FOUND',
        'Оборудование не найдено.',
      );
    }

    assertEquipmentAllowsActiveEvents(equipment.status);

    return {
      id: equipment.id,
      modelId: equipment.model_id,
    };
  }
}
