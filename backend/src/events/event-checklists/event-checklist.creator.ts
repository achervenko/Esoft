import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { throwEventBadRequest } from '../events.errors';
import type { EventChecklistAssignment } from './event-checklists.types';

@Injectable()
export class EventChecklistCreator {
  async createEventChecklists(
    tx: Prisma.TransactionClient,
    params: {
      assignments: EventChecklistAssignment[];
      createdBy: string;
      eventId: number;
      temporarySortOrders?: number[];
      validateFullResponsibleCoverage?: boolean;
    },
  ): Promise<Array<{ assignedUserId: string; id: number }>> {
    this.assertUniqueChecklistAssignees(params.assignments);
    this.assertTemporarySortOrders(
      params.assignments,
      params.temporarySortOrders,
    );
    await this.assertAssignmentsMatchResponsibles(tx, {
      assignments: params.assignments,
      eventId: params.eventId,
      validateFullResponsibleCoverage:
        params.validateFullResponsibleCoverage ?? true,
    });
    await this.assertActiveTemplates(tx, params.assignments);

    const createdChecklistIds: Array<{ assignedUserId: string; id: number }> =
      [];

    for (const [index, assignment] of params.assignments.entries()) {
      const checklist = await tx.checklist.create({
        data: {
          assignedUserId: assignment.assignedUserId,
          checklistTemplateId: assignment.checklistTemplateId,
          createdBy: params.createdBy,
          eventId: params.eventId,
          sortOrder: params.temporarySortOrders?.[index] ?? index + 1,
        },
        select: { id: true },
      });

      await tx.$executeRaw`
        INSERT INTO checklist_details (
          checklist_id,
          checklist_template_question_id,
          checklist_question_id,
          module_name,
          module_sort_order,
          question_text,
          answer_type,
          question_sort_order,
          is_required
        )
        SELECT
          ${checklist.id},
          template_question.id,
          template_question.checklist_question_id,
          template_module.module_name_snapshot,
          template_module.sort_order,
          template_question.question_text_snapshot,
          template_question.answer_type_snapshot,
          template_question.sort_order,
          template_question.is_required
        FROM checklist_template_modules template_module
        JOIN checklist_template_questions template_question
          ON template_question.checklist_template_module_id =
            template_module.id
        WHERE template_module.checklist_template_id =
          ${assignment.checklistTemplateId}
      `;

      createdChecklistIds.push({
        assignedUserId: assignment.assignedUserId,
        id: checklist.id,
      });
    }

    return createdChecklistIds;
  }

  private assertUniqueChecklistAssignees(
    assignments: EventChecklistAssignment[],
  ): void {
    const assignedUserIds = new Set<string>();

    for (const assignment of assignments) {
      if (assignedUserIds.has(assignment.assignedUserId)) {
        throwEventBadRequest(
          'CHECKLIST_ASSIGNEE_DUPLICATE',
          'Ответственному можно назначить только один чек-лист.',
        );
      }

      assignedUserIds.add(assignment.assignedUserId);
    }
  }

  private async assertAssignmentsMatchResponsibles(
    tx: Prisma.TransactionClient,
    params: {
      assignments: EventChecklistAssignment[];
      eventId: number;
      validateFullResponsibleCoverage: boolean;
    },
  ): Promise<void> {
    const responsibles = await tx.eventResponsible.findMany({
      select: { userId: true },
      where: { eventId: params.eventId },
    });
    const responsibleUserIds = new Set(
      responsibles.map((responsible) => responsible.userId),
    );

    if (
      params.validateFullResponsibleCoverage &&
      responsibleUserIds.size !== params.assignments.length
    ) {
      throwEventBadRequest(
        'CHECKLIST_ASSIGNMENTS_REQUIRED',
        'Назначения чек-листов должны полностью покрывать всех ответственных.',
      );
    }

    for (const assignment of params.assignments) {
      if (!responsibleUserIds.has(assignment.assignedUserId)) {
        throwEventBadRequest(
          'CHECKLIST_ASSIGNED_USER_NOT_RESPONSIBLE',
          'Исполнитель чек-листа должен быть ответственным за событие.',
        );
      }
    }
  }

  private async assertActiveTemplates(
    tx: Prisma.TransactionClient,
    assignments: EventChecklistAssignment[],
  ): Promise<void> {
    const checklistTemplateIds = [
      ...new Set(
        assignments.map((assignment) => assignment.checklistTemplateId),
      ),
    ];

    if (checklistTemplateIds.length === 0) {
      return;
    }

    const activeChecklistTemplates = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id
      FROM checklist_templates
      WHERE id IN (${Prisma.join(checklistTemplateIds)})
        AND is_active IS TRUE
        AND is_published IS TRUE
      FOR UPDATE
    `;

    if (activeChecklistTemplates.length !== checklistTemplateIds.length) {
      throwEventBadRequest(
        'CHECKLIST_TEMPLATE_INACTIVE',
        'Можно использовать только активные шаблоны чек-листов.',
      );
    }
  }

  private assertTemporarySortOrders(
    assignments: EventChecklistAssignment[],
    temporarySortOrders?: number[],
  ): void {
    if (temporarySortOrders === undefined) {
      return;
    }

    if (temporarySortOrders.length !== assignments.length) {
      throwEventBadRequest(
        'CHECKLIST_SORT_ORDER_INVALID',
        'Временный порядок чек-листов должен быть задан для каждого назначения.',
      );
    }

    const uniqueSortOrders = new Set<number>();

    for (const sortOrder of temporarySortOrders) {
      if (!Number.isSafeInteger(sortOrder)) {
        throwEventBadRequest(
          'CHECKLIST_SORT_ORDER_INVALID',
          'Временный порядок чек-листов должен быть целым числом.',
        );
      }

      if (uniqueSortOrders.has(sortOrder)) {
        throwEventBadRequest(
          'CHECKLIST_SORT_ORDER_DUPLICATE',
          'Временный порядок чек-листов не должен повторяться.',
        );
      }

      uniqueSortOrders.add(sortOrder);
    }
  }
}
