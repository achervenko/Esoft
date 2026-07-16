import { Injectable } from '@nestjs/common';
import { EquipmentEventStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  getEquipmentEventAuditSnapshot,
  writeEquipmentEventUpdatedAudit,
} from './equipment-events.audit';
import { EquipmentEventInputLoader } from './equipment-event-input.loader';
import { throwEquipmentEventConflict } from './equipment-events.errors';
import { EquipmentEventsQueryService } from './equipment-events-query.service';
import { type UpdateCreatedEquipmentEventData } from './equipment-events.validation';

@Injectable()
export class EquipmentEventsUpdateService {
  constructor(
    private readonly inputLoader: EquipmentEventInputLoader,
    private readonly prisma: PrismaService,
    private readonly queryService: EquipmentEventsQueryService,
  ) {}

  async updateCreated(
    id: number,
    data: UpdateCreatedEquipmentEventData,
    userId?: string | null,
  ) {
    const updatedEventId = await this.prisma.$transaction(async (tx) => {
      const updateInput = await this.inputLoader.loadValidCreatedUpdateInput(
        tx,
        {
          equipmentVisibleId: data.equipmentVisibleId,
          eventId: id,
          maintenanceTypeId: data.maintenanceTypeId,
          responsibleUserIds: data.responsibleUserIds,
        },
      );
      const oldAuditSnapshot = await getEquipmentEventAuditSnapshot(tx, id);
      this.assertVersionMatches(updateInput.version, data.version);
      const hasChanges = this.hasCreatedEventChanges(updateInput, data);

      if (!hasChanges) {
        return id;
      }

      const updateResult = await tx.equipmentEvent.updateMany({
        where: {
          id,
          status: EquipmentEventStatus.CREATED,
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
                executionType: updateInput.maintenanceSetting.executionType,
                maintenanceSettingId: updateInput.maintenanceSetting.id,
              }
            : {}),
          ...(data.note !== undefined ? { note: data.note } : {}),
          ...(data.plannedDate ? { plannedDate: data.plannedDate } : {}),
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

      if (data.responsibleUserIds) {
        const responsibleUserIds = normalizeStringIds(data.responsibleUserIds);

        await tx.equipmentEventResponsible.deleteMany({
          where: { equipmentEventId: id },
        });
        await tx.equipmentEventResponsible.createMany({
          data: responsibleUserIds.map((responsibleUserId) => ({
            equipmentEventId: id,
            userId: responsibleUserId,
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

    return this.queryService.findOne(updatedEventId);
  }

  private assertVersionMatches(
    currentVersion: number,
    expectedVersion: number,
  ) {
    if (currentVersion !== expectedVersion) {
      throwEquipmentEventConflict(
        'EVENT_VERSION_CONFLICT',
        'Событие уже изменено другим запросом. Обновите данные и повторите действие.',
      );
    }
  }

  private hasCreatedEventChanges(
    updateInput: {
      currentNote: string | null;
      currentPlannedDate: Date | null;
      currentResponsibleUserIds: string[];
      equipmentId?: number;
      eventTypeId?: number;
      maintenanceSetting?: {
        executionType: Prisma.EquipmentEventUpdateInput['executionType'];
        id: number;
      };
      version: number;
    },
    data: UpdateCreatedEquipmentEventData,
  ) {
    return (
      updateInput.equipmentId !== undefined ||
      updateInput.eventTypeId !== undefined ||
      this.hasNoteChange(updateInput.currentNote, data.note) ||
      this.hasPlannedDateChange(
        updateInput.currentPlannedDate,
        data.plannedDate,
      ) ||
      this.hasResponsibleUsersChange(
        updateInput.currentResponsibleUserIds,
        data.responsibleUserIds,
      )
    );
  }

  private hasPlannedDateChange(currentValue: Date | null, nextValue?: Date) {
    if (!nextValue) {
      return false;
    }

    return currentValue?.getTime() !== nextValue.getTime();
  }

  private hasResponsibleUsersChange(currentIds: string[], nextIds?: string[]) {
    if (!nextIds) {
      return false;
    }

    return (
      normalizeStringIds(currentIds).join(',') !==
      normalizeStringIds(nextIds).join(',')
    );
  }

  private hasNoteChange(
    currentValue: string | null,
    nextValue?: string | null,
  ) {
    return nextValue !== undefined && currentValue !== nextValue;
  }
}

function normalizeStringIds(ids: string[]) {
  return [...new Set(ids)].sort((left, right) => left.localeCompare(right));
}
