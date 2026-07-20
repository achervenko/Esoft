import { Injectable } from '@nestjs/common';
import { EquipmentEventStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  getEquipmentEventAuditSnapshot,
  writeEquipmentEventUpdatedAudit,
} from './equipment-events.audit';
import { EquipmentEventChecklistCreator } from './equipment-event-checklist.creator';
import { EquipmentEventInputLoader } from './equipment-event-input.loader';
import {
  throwEquipmentEventBadRequest,
  throwEquipmentEventConflict,
} from './equipment-events.errors';
import { EquipmentEventsQueryService } from './equipment-events-query.service';
import {
  assertChecklistAssignmentsMatchResponsibles,
  assertVersionMatches,
  hasChecklistAssignmentsChange,
  hasCreatedEventChanges,
  hasResponsibleUsersChange,
} from './equipment-events-update.assertions';
import { syncEventChecklists } from './equipment-events-update-checklists';
import {
  requireUserId,
  normalizeStringIds,
} from './equipment-events-update.utils';
import { type UpdateCreatedEquipmentEventData } from './equipment-events.validation';

@Injectable()
export class EquipmentEventsUpdateService {
  constructor(
    private readonly checklistCreator: EquipmentEventChecklistCreator,
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

      assertVersionMatches(updateInput.version, data.version);

      const finalResponsibleUserIds =
        data.responsibleUserIds ?? updateInput.currentResponsibleUserIds;
      const currentChecklistAssignments = updateInput.currentChecklists.map(
        (checklist) => ({
          assignedUserId: checklist.assignedUserId,
          checklistTemplateId: checklist.checklistTemplateId,
        }),
      );
      const checklistAssignments =
        data.checklistAssignments ?? currentChecklistAssignments;
      const hasResponsibleSetChange = hasResponsibleUsersChange(
        updateInput.currentResponsibleUserIds,
        data.responsibleUserIds,
      );
      const requiresChecklistAssignments =
        hasResponsibleSetChange ||
        updateInput.equipmentId !== undefined ||
        updateInput.eventTypeId !== undefined;

      if (
        requiresChecklistAssignments &&
        data.checklistAssignments === undefined
      ) {
        throwEquipmentEventBadRequest(
          'CHECKLIST_ASSIGNMENTS_REQUIRED',
          'Передайте полный итоговый массив назначений чек-листов.',
        );
      }

      assertChecklistAssignmentsMatchResponsibles(
        checklistAssignments,
        finalResponsibleUserIds,
      );

      if (data.checklistAssignments !== undefined) {
        const finalMaintenanceSettingId =
          updateInput.maintenanceSetting?.id ??
          updateInput.currentMaintenanceSettingId;

        if (!finalMaintenanceSettingId) {
          throwEquipmentEventBadRequest(
            'CHECKLIST_TEMPLATE_NOT_APPLICABLE',
            'Для события не задана настройка обслуживания.',
          );
        }

        await this.checklistCreator.assertActiveTemplates(
          tx,
          data.checklistAssignments,
          {
            maintenanceSettingId: finalMaintenanceSettingId,
          },
        );
      }

      const hasChecklistAssignmentChanges = hasChecklistAssignmentsChange(
        currentChecklistAssignments,
        data.checklistAssignments,
      );
      const hasChanges = hasCreatedEventChanges(
        updateInput,
        data,
        hasChecklistAssignmentChanges,
      );

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

      if (hasResponsibleSetChange && data.responsibleUserIds) {
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

      if (
        hasChecklistAssignmentChanges ||
        updateInput.equipmentId !== undefined
      ) {
        await syncEventChecklists(tx, this.checklistCreator, {
          assignments: checklistAssignments,
          currentChecklists: updateInput.currentChecklists,
          equipmentChanged: updateInput.equipmentId !== undefined,
          eventId: id,
          userId: requireUserId(userId),
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
}
