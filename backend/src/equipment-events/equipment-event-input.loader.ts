import { Injectable } from '@nestjs/common';
import {
  EquipmentStatus,
  type EquipmentMaintenanceExecutionType,
  EquipmentEventStatus,
  Prisma,
} from '@prisma/client';
import { EquipmentEventAccessAssertions } from './equipment-event-access.assertions';
import {
  throwEquipmentEventBadRequest,
  throwEquipmentEventConflict,
  throwEquipmentEventNotFound,
} from './equipment-events.errors';

@Injectable()
export class EquipmentEventInputLoader {
  constructor(
    private readonly accessAssertions: EquipmentEventAccessAssertions,
  ) {}

  async loadValidEventCreationInput(
    tx: Prisma.TransactionClient,
    params: {
      equipmentVisibleId: number;
      maintenanceTypeId: number;
      responsibleUserIds: string[];
    },
  ) {
    const equipment = await this.loadAndLockEquipmentByVisibleId(
      tx,
      params.equipmentVisibleId,
    );

    const maintenanceSetting =
      await this.loadActiveApplicableMaintenanceSetting(tx, {
        equipmentModelId: equipment.modelId,
        maintenanceTypeId: params.maintenanceTypeId,
      });

    await this.accessAssertions.assertResponsibleUsersExist(
      tx,
      params.responsibleUserIds,
    );

    return { equipment, maintenanceSetting };
  }

  async loadValidCreatedUpdateInput(
    tx: Prisma.TransactionClient,
    params: {
      equipmentVisibleId?: number;
      eventId: number;
      maintenanceTypeId?: number;
      responsibleUserIds?: string[];
    },
  ) {
    await this.lockEventForUpdate(tx, params.eventId);

    const event = await tx.equipmentEvent.findUnique({
      where: { id: params.eventId },
      select: {
        checklists: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          select: {
            assignedUserId: true,
            checklistTemplateId: true,
            id: true,
            sortOrder: true,
          },
        },
        equipment: {
          select: {
            id: true,
            modelId: true,
          },
        },
        eventTypeId: true,
        id: true,
        maintenanceSettingId: true,
        note: true,
        plannedDate: true,
        responsibles: {
          select: {
            userId: true,
          },
        },
        status: true,
        version: true,
      },
    });

    if (!event) {
      throwEquipmentEventNotFound(
        'EVENT_NOT_FOUND',
        'Событие оборудования не найдено.',
      );
    }

    if (event.status !== EquipmentEventStatus.CREATED) {
      throwEquipmentEventConflict(
        'EVENT_STATUS_CONFLICT',
        'Изменять можно только событие до начала работ.',
      );
    }

    const shouldValidateEventType =
      params.equipmentVisibleId !== undefined ||
      params.maintenanceTypeId !== undefined;
    const equipment =
      params.equipmentVisibleId !== undefined
        ? await this.loadAndLockEquipmentByVisibleId(
            tx,
            params.equipmentVisibleId,
          )
        : await this.loadAndLockEquipmentById(tx, event.equipment.id);
    const maintenanceTypeId = params.maintenanceTypeId ?? event.eventTypeId;

    const maintenanceSetting = shouldValidateEventType
      ? await this.loadActiveApplicableMaintenanceSetting(tx, {
          equipmentModelId: equipment.modelId,
          maintenanceTypeId,
        })
      : undefined;

    if (params.responsibleUserIds) {
      await this.accessAssertions.assertResponsibleUsersExist(
        tx,
        params.responsibleUserIds,
      );
    }

    const nextEquipmentId =
      equipment.id === event.equipment.id ? undefined : equipment.id;
    const nextEventTypeId =
      maintenanceTypeId === event.eventTypeId ? undefined : maintenanceTypeId;

    return {
      currentChecklists: event.checklists,
      currentEquipmentId: event.equipment.id,
      currentMaintenanceSettingId: event.maintenanceSettingId,
      currentNote: event.note,
      currentPlannedDate: event.plannedDate,
      currentResponsibleUserIds: event.responsibles.map((item) => item.userId),
      equipmentId: nextEquipmentId,
      eventTypeId: nextEventTypeId,
      maintenanceSetting,
      version: event.version,
    };
  }

  private async loadActiveApplicableMaintenanceSetting(
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
      throwEquipmentEventNotFound(
        'MAINTENANCE_TYPE_NOT_FOUND',
        'Вид обслуживания не найден.',
      );
    }

    if (!eventType.is_active) {
      throwEquipmentEventBadRequest(
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
      throwEquipmentEventBadRequest(
        'MAINTENANCE_SETTING_NOT_FOUND',
        'Настройка обслуживания для этого вида не найдена.',
      );
    }

    return {
      executionType: maintenanceSetting.execution_type,
      id: maintenanceSetting.id,
    };
  }

  private async loadAndLockEquipmentByVisibleId(
    tx: Prisma.TransactionClient,
    visibleId: number,
  ) {
    const rows = await tx.$queryRaw<
      Array<{
        id: number;
        model_id: number;
        name: string;
        status: EquipmentStatus;
        visible_id: number;
      }>
    >`
      SELECT id, model_id, name, status, visible_id
      FROM equipment
      WHERE visible_id = ${visibleId}
      FOR SHARE
    `;
    const equipment = rows[0];

    if (!equipment) {
      throwEquipmentEventNotFound(
        'EQUIPMENT_NOT_FOUND',
        'Оборудование не найдено.',
      );
    }

    this.assertEquipmentAllowsActiveEvents(equipment.status);

    return {
      id: equipment.id,
      modelId: equipment.model_id,
      name: equipment.name,
      visibleId: equipment.visible_id,
    };
  }

  private async loadAndLockEquipmentById(
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
      throwEquipmentEventNotFound(
        'EQUIPMENT_NOT_FOUND',
        'Оборудование не найдено.',
      );
    }

    this.assertEquipmentAllowsActiveEvents(equipment.status);

    return {
      id: equipment.id,
      modelId: equipment.model_id,
    };
  }

  private assertEquipmentAllowsActiveEvents(status: EquipmentStatus) {
    if (status === EquipmentStatus.WRITTEN_OFF) {
      throwEquipmentEventBadRequest(
        'EQUIPMENT_WRITTEN_OFF',
        'Для списанного оборудования нельзя создавать или изменять активные события.',
      );
    }
  }

  private async lockEventForUpdate(
    tx: Prisma.TransactionClient,
    eventId: number,
  ) {
    const lockedEvents = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id
      FROM equipment_events
      WHERE id = ${eventId}
      FOR UPDATE
    `;

    if (lockedEvents.length === 0) {
      throwEquipmentEventNotFound(
        'EVENT_NOT_FOUND',
        'Событие оборудования не найдено.',
      );
    }
  }
}
