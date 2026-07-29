import { Injectable } from '@nestjs/common';
import { EventStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  type EventChecklistCreatorLike,
  syncEventChecklists,
} from './event-checklists/event-checklists.sync';
import { getEventAuditSnapshot, writeEventUpdatedAudit } from './events.audit';
import { throwEventBadRequest, throwEventConflict } from './events.errors';
import { EventsUpdateInputLoader } from './events-update-input.loader';
import {
  assertChecklistAssignmentsMatchResponsibles,
  assertVersionMatches,
  hasChecklistAssignmentsChange,
  hasCreatedEventChanges,
  hasResponsibleUsersChange,
} from './events-update.assertions';
import type {
  EventUpdateExtensionOptions,
  EventUpdateExtensionOptionsResolver,
  UpdateCreatedEventResult,
  UpdateCreatedEventData,
} from './events-update.types';
import {
  normalizeStringIds,
  requireEventUpdateUserId,
} from './events-update.utils';

@Injectable()
export class EventsUpdateService {
  constructor(
    private readonly inputLoader: EventsUpdateInputLoader,
    private readonly prisma: PrismaService,
  ) {}

  updateCreated(
    checklistCreator: EventChecklistCreatorLike,
    id: number,
    data: UpdateCreatedEventData,
    userId?: string | null,
    resolveExtensionOptions?: EventUpdateExtensionOptionsResolver,
  ): Promise<UpdateCreatedEventResult> {
    return this.prisma.$transaction((tx) =>
      this.updateCreatedInTransaction(
        tx,
        checklistCreator,
        id,
        data,
        userId,
        resolveExtensionOptions,
      ),
    );
  }

  async updateCreatedInTransaction(
    tx: Prisma.TransactionClient,
    checklistCreator: EventChecklistCreatorLike,
    id: number,
    data: UpdateCreatedEventData,
    userId?: string | null,
    resolveExtensionOptions?: EventUpdateExtensionOptionsResolver,
  ): Promise<UpdateCreatedEventResult> {
    const updateInput = await this.inputLoader.loadValidCreatedUpdateInput(tx, {
      eventId: id,
      responsibleUserIds: data.responsibleUserIds,
    });
    const oldAuditSnapshot = await getEventAuditSnapshot(tx, id);
    const extensionOptions =
      (await resolveExtensionOptions?.({
        currentState: updateInput,
        eventId: id,
        tx,
      })) ?? {};

    this.assertExtensionOptionsAreConsistent(extensionOptions);

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
      extensionOptions.requiresChecklistAssignments === true;

    if (
      requiresChecklistAssignments &&
      data.checklistAssignments === undefined
    ) {
      throwEventBadRequest(
        'CHECKLIST_ASSIGNMENTS_REQUIRED',
        'Передайте полный итоговый массив назначений чек-листов.',
      );
    }

    assertChecklistAssignmentsMatchResponsibles(
      checklistAssignments,
      finalResponsibleUserIds,
    );

    if (
      data.checklistAssignments !== undefined &&
      extensionOptions.validateChecklists
    ) {
      await extensionOptions.validateChecklists({
        assignments: data.checklistAssignments,
        tx,
      });
    }

    const hasChecklistAssignmentChanges = hasChecklistAssignmentsChange(
      currentChecklistAssignments,
      data.checklistAssignments,
    );
    const checklistMutationUserId = hasChecklistAssignmentChanges
      ? requireEventUpdateUserId(userId)
      : undefined;
    const hasChanges = hasCreatedEventChanges(updateInput, data, {
      hasChecklistAssignmentChanges,
      hasExtensionChanges: extensionOptions.hasExtensionChanges === true,
    });

    if (!hasChanges) {
      return {
        eventId: id,
        updated: false,
      };
    }

    const updateResult = await tx.event.updateMany({
      where: {
        id,
        status: EventStatus.CREATED,
        version: data.version,
      },
      data: {
        ...(data.note !== undefined ? { note: data.note } : {}),
        ...(data.plannedDate !== undefined
          ? { plannedDate: data.plannedDate }
          : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        version: {
          increment: 1,
        },
      },
    });

    if (updateResult.count !== 1) {
      throwEventConflict(
        'EVENT_VERSION_CONFLICT',
        'Событие уже изменено другим запросом. Обновите данные и повторите действие.',
      );
    }

    await extensionOptions.updateExtension?.({
      eventId: id,
      tx,
    });

    if (hasResponsibleSetChange && data.responsibleUserIds) {
      const responsibleUserIds = normalizeStringIds(data.responsibleUserIds);

      await tx.eventResponsible.deleteMany({
        where: { eventId: id },
      });
      await tx.eventResponsible.createMany({
        data: responsibleUserIds.map((responsibleUserId) => ({
          eventId: id,
          userId: responsibleUserId,
        })),
      });
    }

    if (hasChecklistAssignmentChanges) {
      await syncEventChecklists(tx, checklistCreator, {
        assignments: checklistAssignments,
        currentChecklists: updateInput.currentChecklists,
        eventId: id,
        userId: checklistMutationUserId!,
      });
    }

    const auditSnapshot = await getEventAuditSnapshot(tx, id);
    await writeEventUpdatedAudit(tx, {
      newEvent: auditSnapshot,
      oldEvent: oldAuditSnapshot,
      userId,
    });
    await extensionOptions.afterUpdate?.({
      eventId: id,
      tx,
    });

    return {
      eventId: id,
      updated: true,
    };
  }

  private assertExtensionOptionsAreConsistent(
    options: EventUpdateExtensionOptions,
  ): void {
    if (options.hasExtensionChanges === true && !options.updateExtension) {
      throwEventBadRequest(
        'EVENT_EXTENSION_UPDATE_REQUIRED',
        'Для изменения расширения события не задан обработчик.',
      );
    }

    if (options.hasExtensionChanges !== true && options.updateExtension) {
      throwEventBadRequest(
        'EVENT_EXTENSION_UPDATE_UNEXPECTED',
        'Для события без изменения расширения нельзя передавать обработчик расширения.',
      );
    }
  }
}
