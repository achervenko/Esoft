import { Injectable } from '@nestjs/common';
import { EquipmentEventStatus, Prisma } from '@prisma/client';
import {
  throwEquipmentEventBadRequest,
  throwEquipmentEventConflict,
  throwEquipmentEventForbidden,
  throwEquipmentEventNotFound,
} from './equipment-events.errors';

@Injectable()
export class EquipmentEventsAssertions {
  async getCurrentEmployeeId(
    tx: Prisma.TransactionClient,
    userId?: string | null,
  ) {
    if (!userId) {
      throwEquipmentEventForbidden(
        'SESSION_REQUIRED',
        'Сессия пользователя не найдена.',
      );
    }

    const employeeUser = await tx.employeeUser.findUnique({
      where: { userId },
      select: { employeeId: true },
    });

    if (!employeeUser) {
      throwEquipmentEventForbidden(
        'USER_EMPLOYEE_NOT_FOUND',
        'К учётной записи не привязан сотрудник.',
      );
    }

    return employeeUser.employeeId;
  }

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

    const maintenanceSetting = await this.loadActiveApplicableMaintenanceSetting(tx, {
      equipmentModelId: equipment.modelId,
      maintenanceTypeId: params.maintenanceTypeId,
    });

    await this.assertResponsibleUsersExist(tx, params.responsibleUserIds);

    return { equipment, maintenanceSetting };
  }

  async assertEventCanBeCompleted(
    tx: Prisma.TransactionClient,
    eventId: number,
    userId?: string | null,
  ) {
    const event = await tx.equipmentEvent.findUnique({
      where: { id: eventId },
      select: {
        factDate: true,
        id: true,
        responsibles: {
          select: {
            userId: true,
          },
        },
        status: true,
      },
    });

    if (!event) {
      throwEquipmentEventNotFound(
        'EVENT_NOT_FOUND',
        'Событие оборудования не найдено.',
      );
    }

    if (event.status !== EquipmentEventStatus.IN_PROGRESS) {
      throwEquipmentEventConflict(
        'EVENT_STATUS_CONFLICT',
        'Событие в текущем статусе нельзя завершить.',
      );
    }

    if (event.responsibles.length === 0) {
      throwEquipmentEventBadRequest(
        'RESPONSIBLES_REQUIRED',
        'У события должен быть хотя бы один ответственный.',
      );
    }

    this.assertAssignedResponsible(event.responsibles, userId);

    return event;
  }

  async assertEventCanBeCancelled(
    tx: Prisma.TransactionClient,
    eventId: number,
  ) {
    const event = await tx.equipmentEvent.findUnique({
      where: { id: eventId },
      select: { id: true, status: true },
    });

    if (!event) {
      throwEquipmentEventNotFound(
        'EVENT_NOT_FOUND',
        'Событие оборудования не найдено.',
      );
    }

    if (
      event.status !== EquipmentEventStatus.CREATED &&
      event.status !== EquipmentEventStatus.IN_PROGRESS
    ) {
      throwEquipmentEventConflict(
        'EVENT_STATUS_CONFLICT',
        'Событие в текущем статусе нельзя отменить.',
      );
    }

    return event;
  }

  async assertEventCanBeStarted(
    tx: Prisma.TransactionClient,
    eventId: number,
    userId?: string | null,
  ) {
    const event = await tx.equipmentEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        responsibles: {
          select: {
            userId: true,
          },
        },
        status: true,
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
        'Событие в текущем статусе нельзя взять в работу.',
      );
    }

    this.assertAssignedResponsible(event.responsibles, userId);

    return event;
  }

  private assertAssignedResponsible(
    responsibles: Array<{ userId: string }>,
    userId?: string | null,
  ) {
    if (!userId || !responsibles.some((item) => item.userId === userId)) {
      throwEquipmentEventForbidden(
        'EVENT_RESPONSIBLE_REQUIRED',
        'Только назначенный ответственный может выполнить это действие.',
      );
    }
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
    const event = await tx.equipmentEvent.findUnique({
      where: { id: params.eventId },
      select: {
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
        'Изменять можно только назначенное событие до начала работ.',
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
      await this.assertResponsibleUsersExist(tx, params.responsibleUserIds);
    }

    return {
      currentNote: event.note,
      currentPlannedDate: event.plannedDate,
      currentResponsibleUserIds: event.responsibles.map(
        (item) => item.userId,
      ),
      equipmentId:
        equipment.id === event.equipment.id ? undefined : equipment.id,
      eventTypeId:
        maintenanceTypeId === event.eventTypeId ? undefined : maintenanceTypeId,
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
        checklistTemplateId: true,
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

    return maintenanceSetting;
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

  private async assertResponsibleUsersExist(
    tx: Prisma.TransactionClient,
    userIds: string[],
  ) {
    const uniqueUserIds = [...new Set(userIds)];

    if (uniqueUserIds.length === 0) {
      throwEquipmentEventBadRequest(
        'RESPONSIBLES_REQUIRED',
        'У события должен быть хотя бы один ответственный.',
      );
    }

    const users = await tx.user.findMany({
      where: {
        id: {
          in: uniqueUserIds,
        },
        employeeUser: {
          isNot: null,
        },
      },
      select: { banned: true, id: true },
    });

    if (users.length !== uniqueUserIds.length) {
      throwEquipmentEventNotFound(
        'RESPONSIBLE_NOT_FOUND',
        'Один или несколько ответственных пользователей не найдены.',
      );
    }

    if (users.some((user) => user.banned)) {
      throwEquipmentEventBadRequest(
        'RESPONSIBLE_USER_INACTIVE',
        'Один или несколько ответственных пользователей отключены.',
      );
    }
  }
}
