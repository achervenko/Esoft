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
      responsibleEmployeeIds: number[];
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

    await this.assertEmployeesExist(tx, params.responsibleEmployeeIds);

    return { equipment, maintenanceSetting };
  }

  async assertEventCanBeCompleted(
    tx: Prisma.TransactionClient,
    eventId: number,
  ) {
    const event = await tx.equipmentEvent.findUnique({
      where: { id: eventId },
      select: {
        factDate: true,
        id: true,
        responsibles: {
          select: {
            employeeId: true,
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

    if (
      event.status !== EquipmentEventStatus.DRAFT &&
      event.status !== EquipmentEventStatus.CREATED
    ) {
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
      event.status !== EquipmentEventStatus.DRAFT &&
      event.status !== EquipmentEventStatus.CREATED
    ) {
      throwEquipmentEventConflict(
        'EVENT_STATUS_CONFLICT',
        'Событие в текущем статусе нельзя отменить.',
      );
    }

    return event;
  }

  async loadValidDraftUpdateInput(
    tx: Prisma.TransactionClient,
    params: {
      equipmentVisibleId?: number;
      eventId: number;
      maintenanceTypeId?: number;
      responsibleEmployeeIds?: number[];
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
        factDate: true,
        id: true,
        note: true,
        responsibles: {
          select: {
            employeeId: true,
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

    if (event.status !== EquipmentEventStatus.DRAFT) {
      throwEquipmentEventConflict(
        'EVENT_STATUS_CONFLICT',
        'Изменять можно только черновик события.',
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

    if (params.responsibleEmployeeIds) {
      await this.assertEmployeesExist(tx, params.responsibleEmployeeIds);
    }

    return {
      currentFactDate: event.factDate,
      currentNote: event.note,
      currentResponsibleEmployeeIds: event.responsibles.map(
        (item) => item.employeeId,
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

  private async assertEmployeesExist(
    tx: Prisma.TransactionClient,
    employeeIds: number[],
  ) {
    const uniqueEmployeeIds = [...new Set(employeeIds)];

    if (uniqueEmployeeIds.length === 0) {
      throwEquipmentEventBadRequest(
        'RESPONSIBLES_REQUIRED',
        'У события должен быть хотя бы один ответственный.',
      );
    }

    const employees = await tx.employee.findMany({
      where: {
        id: {
          in: uniqueEmployeeIds,
        },
      },
      select: { id: true },
    });

    if (employees.length !== uniqueEmployeeIds.length) {
      throwEquipmentEventNotFound(
        'RESPONSIBLE_NOT_FOUND',
        'Один или несколько ответственных не найдены.',
      );
    }
  }
}
