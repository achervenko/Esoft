import { Prisma } from '@prisma/client';
import { throwEventConflict } from '../events.errors';
import type {
  CurrentEventChecklistState,
  EventChecklistAssignment,
} from './event-checklists.types';

export type EventChecklistCreatorLike = {
  createEventChecklists(
    tx: Prisma.TransactionClient,
    params: {
      assignments: EventChecklistAssignment[];
      createdBy: string;
      eventId: number;
      temporarySortOrders?: number[];
      validateFullResponsibleCoverage?: boolean;
    },
  ): Promise<Array<{ assignedUserId: string; id: number }>>;
};

export async function syncEventChecklists(
  tx: Prisma.TransactionClient,
  checklistCreator: EventChecklistCreatorLike,
  params: {
    assignments: EventChecklistAssignment[];
    currentChecklists: CurrentEventChecklistState[];
    eventId: number;
    userId: string;
  },
) {
  const currentByAssignedUserId = new Map(
    params.currentChecklists.map((checklist) => [
      checklist.assignedUserId,
      checklist,
    ]),
  );
  const survivorIds: number[] = [];
  const deleteIds: number[] = [];
  const createAssignments: EventChecklistAssignment[] = [];

  for (const currentChecklist of params.currentChecklists) {
    const nextAssignment = params.assignments.find(
      (assignment) =>
        assignment.assignedUserId === currentChecklist.assignedUserId,
    );

    if (!nextAssignment) {
      deleteIds.push(currentChecklist.id);
      continue;
    }

    if (
      nextAssignment.checklistTemplateId !==
      currentChecklist.checklistTemplateId
    ) {
      deleteIds.push(currentChecklist.id);
      createAssignments.push(nextAssignment);
      continue;
    }

    survivorIds.push(currentChecklist.id);
  }

  for (const assignment of params.assignments) {
    if (!currentByAssignedUserId.has(assignment.assignedUserId)) {
      createAssignments.push(assignment);
    }
  }

  let temporarySortOrder = -1;

  for (const checklistId of survivorIds) {
    const updateResult = await tx.checklist.updateMany({
      data: { sortOrder: temporarySortOrder },
      where: {
        eventId: params.eventId,
        id: checklistId,
      },
    });

    if (updateResult.count !== 1) {
      throwEventConflict(
        'CHECKLIST_SYNC_CONFLICT',
        'Не удалось синхронизировать чек-листы события.',
      );
    }

    temporarySortOrder -= 1;
  }

  if (deleteIds.length > 0) {
    await tx.checklist.deleteMany({
      where: {
        eventId: params.eventId,
        id: { in: deleteIds },
      },
    });
  }

  if (createAssignments.length > 0) {
    const temporarySortOrders = createAssignments.map(() => {
      const value = temporarySortOrder;
      temporarySortOrder -= 1;
      return value;
    });

    await checklistCreator.createEventChecklists(tx, {
      assignments: createAssignments,
      createdBy: params.userId,
      eventId: params.eventId,
      temporarySortOrders,
      validateFullResponsibleCoverage: false,
    });
  }

  const finalChecklists = await tx.checklist.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { assignedUserId: true, id: true },
    where: { eventId: params.eventId },
  });
  const finalChecklistIdByAssignedUserId = new Map(
    finalChecklists.map((checklist) => [
      checklist.assignedUserId,
      checklist.id,
    ]),
  );

  for (const [index, assignment] of params.assignments.entries()) {
    const checklistId = finalChecklistIdByAssignedUserId.get(
      assignment.assignedUserId,
    );

    if (!checklistId) {
      throwEventConflict(
        'CHECKLIST_SYNC_CONFLICT',
        'Не удалось синхронизировать чек-листы события.',
      );
    }

    const updateResult = await tx.checklist.updateMany({
      data: { sortOrder: index + 1 },
      where: {
        eventId: params.eventId,
        id: checklistId,
      },
    });

    if (updateResult.count !== 1) {
      throwEventConflict(
        'CHECKLIST_SYNC_CONFLICT',
        'Не удалось синхронизировать чек-листы события.',
      );
    }
  }
}
