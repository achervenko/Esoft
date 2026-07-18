import { Injectable } from '@nestjs/common';
import { EquipmentEventStatus, Prisma } from '@prisma/client';
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
    const equipment = await tx.equipment.findUnique({
      where: { visibleId: params.equipmentVisibleId },
      select: {
        id: true,
        modelId: true,
        name: true,
        visibleId: true,
      },
    });

    if (!equipment) {
      throwEquipmentEventNotFound(
        'EQUIPMENT_NOT_FOUND',
        'Оборудование не найдено.',
      );
    }

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
    const equipment = params.equipmentVisibleId
      ? await this.loadEquipmentByVisibleId(tx, params.equipmentVisibleId)
      : event.equipment;
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
    const eventType = await tx.equipmentEventType.findUnique({
      where: { id: params.maintenanceTypeId },
      select: { id: true, isActive: true },
    });

    if (!eventType) {
      throwEquipmentEventNotFound(
        'MAINTENANCE_TYPE_NOT_FOUND',
        'Вид обслуживания не найден.',
      );
    }

    if (!eventType.isActive) {
      throwEquipmentEventBadRequest(
        'MAINTENANCE_TYPE_INACTIVE',
        'Вид обслуживания отключён.',
      );
    }

    const maintenanceSetting = await tx.equipmentMaintenanceSetting.findUnique({
      where: {
        equipmentModelId_maintenanceTypeId: {
          equipmentModelId: params.equipmentModelId,
          maintenanceTypeId: params.maintenanceTypeId,
        },
      },
      select: {
        executionType: true,
        id: true,
      },
    });

    if (!maintenanceSetting) {
      throwEquipmentEventBadRequest(
        'MAINTENANCE_SETTING_NOT_FOUND',
        'Настройка обслуживания для этого вида не найдена.',
      );
    }

    return {
      executionType: maintenanceSetting.executionType,
      id: maintenanceSetting.id,
    };
  }

  private async loadEquipmentByVisibleId(
    tx: Prisma.TransactionClient,
    visibleId: number,
  ) {
    const equipment = await tx.equipment.findUnique({
      where: { visibleId },
      select: {
        id: true,
        modelId: true,
      },
    });

    if (!equipment) {
      throwEquipmentEventNotFound(
        'EQUIPMENT_NOT_FOUND',
        'Оборудование не найдено.',
      );
    }

    return equipment;
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
