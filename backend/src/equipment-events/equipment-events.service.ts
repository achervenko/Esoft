import { Injectable } from '@nestjs/common';
import { EquipmentEventStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  throwEquipmentEventBadRequest,
  throwEquipmentEventConflict,
  throwEquipmentEventNotFound,
} from './equipment-events.errors';
import {
  equipmentEventDetailSelect,
  equipmentEventListSelect,
} from './equipment-events.relations';
import { EquipmentEventsAssertions } from './equipment-events.assertions';
import { EquipmentEventsCreator } from './equipment-events.creator';
import {
  type CompleteEquipmentEventData,
  type CreateManualEquipmentEventData,
  type EquipmentEventsQuery,
  type UpdateDraftEquipmentEventData,
} from './equipment-events.validation';
import {
  toEquipmentEventDetailResponse,
  toEquipmentEventListResponse,
} from './equipment-events.presenter';
import {
  getEquipmentEventAuditSnapshot,
  writeEquipmentEventStatusAudit,
  writeEquipmentEventUpdatedAudit,
} from './equipment-events.audit';

@Injectable()
export class EquipmentEventsService {
  constructor(
    private readonly assertions: EquipmentEventsAssertions,
    private readonly creator: EquipmentEventsCreator,
    private readonly prisma: PrismaService,
  ) {}

  async findAll(query: EquipmentEventsQuery) {
    const where: Prisma.EquipmentEventWhereInput = {
      ...(query.equipmentVisibleId
        ? { equipment: { visibleId: query.equipmentVisibleId } }
        : {}),
      ...(query.maintenanceTypeId
        ? { eventTypeId: query.maintenanceTypeId }
        : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.responsibleEmployeeId
        ? {
            responsibles: {
              some: {
                employeeId: query.responsibleEmployeeId,
              },
            },
          }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            factDate: {
              ...(query.dateFrom ? { gte: query.dateFrom } : {}),
              ...(query.dateTo ? { lte: query.dateTo } : {}),
            },
          }
        : {}),
    };

    const events = await this.prisma.equipmentEvent.findMany({
      where,
      select: equipmentEventListSelect,
      orderBy: [
        { factDate: { sort: 'desc', nulls: 'last' } },
        { plannedDate: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      skip: query.offset,
      take: query.limit,
    });

    return events.map(toEquipmentEventListResponse);
  }

  async findOne(id: number) {
    const event = await this.prisma.equipmentEvent.findUnique({
      where: { id },
      select: equipmentEventDetailSelect,
    });

    if (!event) {
      throwEquipmentEventNotFound(
        'EVENT_NOT_FOUND',
        'Событие оборудования не найдено.',
      );
    }

    return toEquipmentEventDetailResponse(event);
  }

  async createManual(
    data: CreateManualEquipmentEventData,
    userId?: string | null,
  ) {
    const createdEventId = await this.creator.create(
      {
        kind: 'manual',
        equipmentVisibleId: data.equipmentVisibleId,
        factDate: data.factDate,
        maintenanceTypeId: data.maintenanceTypeId,
        note: data.note,
        responsibleEmployeeIds: data.responsibleEmployeeIds,
      },
      userId,
    );

    return this.findOne(createdEventId);
  }

  async updateDraft(
    id: number,
    data: UpdateDraftEquipmentEventData,
    userId?: string | null,
  ) {
    const updatedEventId = await this.prisma.$transaction(async (tx) => {
      const updateInput = await this.assertions.loadValidDraftUpdateInput(tx, {
        equipmentVisibleId: data.equipmentVisibleId,
        eventId: id,
        maintenanceTypeId: data.maintenanceTypeId,
        responsibleEmployeeIds: data.responsibleEmployeeIds,
      });
      const oldAuditSnapshot = await getEquipmentEventAuditSnapshot(tx, id);
      this.assertDraftVersionMatches(updateInput.version, data.version);
      const hasChanges = this.hasDraftChanges(updateInput, data);

      if (!hasChanges) {
        return id;
      }

      const updateResult = await tx.equipmentEvent.updateMany({
        where: {
          id,
          status: EquipmentEventStatus.DRAFT,
          version: data.version,
        },
        data: {
          ...(updateInput.equipmentId
            ? { equipmentId: updateInput.equipmentId }
            : {}),
          ...(updateInput.eventTypeId
            ? { eventTypeId: updateInput.eventTypeId }
            : {}),
          ...(updateInput.maintenanceSetting
            ? {
                checklistTemplateId:
                  updateInput.maintenanceSetting.checklistTemplateId,
                executionType: updateInput.maintenanceSetting.executionType,
                maintenanceSettingId: updateInput.maintenanceSetting.id,
              }
            : {}),
          ...(data.factDate ? { factDate: data.factDate } : {}),
          ...(data.note !== undefined ? { note: data.note } : {}),
          status: EquipmentEventStatus.DRAFT,
          version: {
            increment: 1,
          },
        },
      });

      if (updateResult.count !== 1) {
        throwEquipmentEventConflict(
          'EVENT_VERSION_CONFLICT',
          'Событие уже изменено другим запросом. Обновите данные и повторите действие.',
        );
      }

      if (data.responsibleEmployeeIds) {
        const responsibleEmployeeIds = normalizeIds(data.responsibleEmployeeIds);

        await tx.equipmentEventResponsible.deleteMany({
          where: { equipmentEventId: id },
        });
        await tx.equipmentEventResponsible.createMany({
          data: responsibleEmployeeIds.map((employeeId) => ({
            employeeId,
            equipmentEventId: id,
          })),
        });
      }

      const auditSnapshot = await getEquipmentEventAuditSnapshot(tx, id);
      await writeEquipmentEventUpdatedAudit(tx, {
        newEvent: auditSnapshot,
        oldEvent: oldAuditSnapshot,
        userId,
      });

      return id;
    });

    return this.findOne(updatedEventId);
  }

  async complete(
    id: number,
    data: CompleteEquipmentEventData,
    userId?: string | null,
  ) {
    const updatedEventId = await this.prisma.$transaction(async (tx) => {
      const event = await this.assertions.assertEventCanBeCompleted(tx, id);

      const factDate = data.factDate ?? event.factDate;

      if (!factDate) {
        throwEquipmentEventBadRequest(
          'FACT_DATE_REQUIRED',
          'Укажите фактическую дату события.',
        );
      }

      await this.assertChecklistAllowsCompletion(tx, id);

      const updateResult = await tx.equipmentEvent.updateMany({
        where: {
          id,
          status: {
            in: [EquipmentEventStatus.DRAFT, EquipmentEventStatus.CREATED],
          },
        },
        data: {
          factDate,
          status: EquipmentEventStatus.COMPLETED,
        },
      });

      if (updateResult.count !== 1) {
        throwEquipmentEventConflict(
          'EVENT_STATUS_CONFLICT',
          'Событие в текущем статусе нельзя завершить.',
        );
      }

      const auditSnapshot = await getEquipmentEventAuditSnapshot(tx, id);
      await writeEquipmentEventStatusAudit(tx, {
        event: auditSnapshot,
        newStatus: EquipmentEventStatus.COMPLETED,
        oldStatus: event.status,
        userId,
      });

      return id;
    });

    return this.findOne(updatedEventId);
  }

  async cancel(id: number, userId?: string | null) {
    const updatedEventId = await this.prisma.$transaction(async (tx) => {
      const event = await this.assertions.assertEventCanBeCancelled(tx, id);

      const updateResult = await tx.equipmentEvent.updateMany({
        where: {
          id,
          status: {
            in: [EquipmentEventStatus.DRAFT, EquipmentEventStatus.CREATED],
          },
        },
        data: {
          status: EquipmentEventStatus.CANCELLED,
        },
      });

      if (updateResult.count !== 1) {
        throwEquipmentEventConflict(
          'EVENT_STATUS_CONFLICT',
          'Событие в текущем статусе нельзя отменить.',
        );
      }

      const auditSnapshot = await getEquipmentEventAuditSnapshot(tx, id);
      await writeEquipmentEventStatusAudit(tx, {
        event: auditSnapshot,
        newStatus: EquipmentEventStatus.CANCELLED,
        oldStatus: event.status,
        userId,
      });

      return id;
    });

    return this.findOne(updatedEventId);
  }

  private async assertChecklistAllowsCompletion(
    _tx: Prisma.TransactionClient,
    _eventId: number,
  ) {
    return;
  }

  private assertDraftVersionMatches(currentVersion: number, expectedVersion: number) {
    if (currentVersion !== expectedVersion) {
      throwEquipmentEventConflict(
        'EVENT_VERSION_CONFLICT',
        'Событие уже изменено другим запросом. Обновите данные и повторите действие.',
      );
    }
  }

  private hasDraftChanges(
    updateInput: {
      currentFactDate: Date | null;
      currentNote: string | null;
      currentResponsibleEmployeeIds: number[];
      equipmentId?: number;
      eventTypeId?: number;
      maintenanceSetting?: {
        checklistTemplateId: number | null;
        executionType: Prisma.EquipmentEventUpdateInput['executionType'];
        id: number;
      };
      version: number;
    },
    data: UpdateDraftEquipmentEventData,
  ) {
    return (
      updateInput.equipmentId !== undefined ||
      updateInput.eventTypeId !== undefined ||
      this.hasFactDateChange(updateInput.currentFactDate, data.factDate) ||
      this.hasNoteChange(updateInput.currentNote, data.note) ||
      this.hasResponsibleEmployeesChange(
        updateInput.currentResponsibleEmployeeIds,
        data.responsibleEmployeeIds,
      )
    );
  }

  private hasFactDateChange(currentValue: Date | null, nextValue?: Date) {
    if (!nextValue) {
      return false;
    }

    return currentValue?.getTime() !== nextValue.getTime();
  }

  private hasResponsibleEmployeesChange(
    currentIds: number[],
    nextIds?: number[],
  ) {
    if (!nextIds) {
      return false;
    }

    return normalizeIds(currentIds).join(',') !== normalizeIds(nextIds).join(',');
  }

  private hasNoteChange(currentValue: string | null, nextValue?: string | null) {
    return nextValue !== undefined && currentValue !== nextValue;
  }
}

function normalizeIds(ids: number[]) {
  return [...new Set(ids)].sort((left, right) => left - right);
}

