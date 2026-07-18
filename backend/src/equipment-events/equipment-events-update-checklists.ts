import { Prisma } from '@prisma/client';
import { EquipmentEventChecklistCreator } from './equipment-event-checklist.creator';
import { throwEquipmentEventConflict } from './equipment-events.errors';
import {
  type EquipmentEventChecklistAssignment,
} from './equipment-events.validation';
import { type CurrentChecklistState } from './equipment-events-update.types';

export async function syncEventChecklists(
  tx: Prisma.TransactionClient,
  checklistCreator: EquipmentEventChecklistCreator,
  params: {
    assignments: EquipmentEventChecklistAssignment[];
    currentChecklists: CurrentChecklistState[];
    equipmentChanged: boolean;
    eventId: number;
    userId: string;
  },
) {
  if (params.equipmentChanged) {
    await tx.checklist.deleteMany({
      where: { equipmentEventId: params.eventId },
    });

    await checklistCreator.createEventChecklists(tx, {
      assignments: params.assignments,
      createdBy: params.userId,
      eventId: params.eventId,
    });

    return;
  }

  const currentByAssignedUserId = new Map(
    params.currentChecklists.map((checklist) => [
      checklist.assignedUserId,
      checklist,
    ]),
  );
  const survivorIds: number[] = [];
  const deleteIds: number[] = [];
  const createAssignments: EquipmentEventChecklistAssignment[] = [];

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
      nextAssignment.checklistTemplateId !== currentChecklist.checklistTemplateId
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
    await tx.checklist.update({
      data: { sortOrder: temporarySortOrder },
      where: { id: checklistId },
    });
    temporarySortOrder -= 1;
  }

  if (deleteIds.length > 0) {
    await tx.checklist.deleteMany({
      where: {
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
    });
  }

  const finalChecklists = await tx.checklist.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { assignedUserId: true, id: true },
    where: { equipmentEventId: params.eventId },
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
      throwEquipmentEventConflict(
        'CHECKLIST_ASSIGNMENT_TEMPLATE_INVALID',
        'Не удалось синхронизировать чек-листы события.',
      );
    }

    await tx.checklist.update({
      data: { sortOrder: index + 1 },
      where: { id: checklistId },
    });
  }
}
