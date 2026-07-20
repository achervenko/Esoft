import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  throwEquipmentEventBadRequest,
  throwEquipmentEventNotFound,
} from './equipment-events.errors';
import { type EquipmentEventChecklistAssignment } from './equipment-events.validation';

@Injectable()
export class EquipmentEventChecklistCreator {
  async createEventChecklists(
    tx: Prisma.TransactionClient,
    params: {
      assignments: EquipmentEventChecklistAssignment[];
      createdBy: string;
      eventId: number;
      temporarySortOrders?: number[];
      validateFullResponsibleCoverage?: boolean;
    },
  ) {
    this.assertUniqueChecklistAssignees(params.assignments);
    this.assertTemporarySortOrders(
      params.assignments,
      params.temporarySortOrders,
    );

    const event = await tx.equipmentEvent.findUnique({
      select: { equipmentId: true, id: true, maintenanceSettingId: true },
      where: { id: params.eventId },
    });

    if (!event) {
      throwEquipmentEventNotFound(
        'EVENT_NOT_FOUND',
        'Событие оборудования не найдено.',
      );
    }

    await this.assertAssignmentsMatchResponsibles(tx, {
      assignments: params.assignments,
      eventId: params.eventId,
      validateFullResponsibleCoverage:
        params.validateFullResponsibleCoverage ?? true,
    });

    if (!event.maintenanceSettingId) {
      throwEquipmentEventBadRequest(
        'CHECKLIST_TEMPLATE_NOT_APPLICABLE',
        'Для события не задана настройка обслуживания.',
      );
    }

    await this.assertActiveTemplates(tx, params.assignments, {
      maintenanceSettingId: event.maintenanceSettingId,
    });

    const createdChecklistIds: Array<{ assignedUserId: string; id: number }> =
      [];

    for (const [index, assignment] of params.assignments.entries()) {
      const checklist = await tx.checklist.create({
        data: {
          assignedUserId: assignment.assignedUserId,
          checklistTemplateId: assignment.checklistTemplateId,
          createdBy: params.createdBy,
          equipmentEventId: params.eventId,
          equipmentId: event.equipmentId,
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
    assignments: EquipmentEventChecklistAssignment[],
  ) {
    const assignedUserIds = new Set<string>();

    for (const assignment of assignments) {
      if (assignedUserIds.has(assignment.assignedUserId)) {
        throwEquipmentEventBadRequest(
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
      assignments: EquipmentEventChecklistAssignment[];
      eventId: number;
      validateFullResponsibleCoverage: boolean;
    },
  ) {
    const responsibles = await tx.equipmentEventResponsible.findMany({
      select: { userId: true },
      where: { equipmentEventId: params.eventId },
    });
    const responsibleUserIds = new Set(
      responsibles.map((responsible) => responsible.userId),
    );

    if (
      params.validateFullResponsibleCoverage &&
      responsibleUserIds.size !== params.assignments.length
    ) {
      throwEquipmentEventBadRequest(
        'CHECKLIST_ASSIGNMENTS_REQUIRED',
        'Назначения чек-листов должны полностью покрывать всех ответственных.',
      );
    }

    for (const assignment of params.assignments) {
      if (!responsibleUserIds.has(assignment.assignedUserId)) {
        throwEquipmentEventBadRequest(
          'CHECKLIST_ASSIGNED_USER_NOT_RESPONSIBLE',
          'Исполнитель чек-листа должен быть ответственным за событие.',
        );
      }
    }
  }

  async assertActiveTemplates(
    tx: Prisma.TransactionClient,
    assignments: EquipmentEventChecklistAssignment[],
    options: {
      maintenanceSettingId: number;
    },
  ) {
    const checklistTemplateIds = [
      ...new Set(
        assignments.map((assignment) => assignment.checklistTemplateId),
      ),
    ];

    if (checklistTemplateIds.length === 0) {
      return;
    }

    await this.assertTemplatesMatchMaintenanceSetting(tx, {
      checklistTemplateIds,
      maintenanceSettingId: options.maintenanceSettingId,
    });

    const activeChecklistTemplates = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id
      FROM checklist_templates
      WHERE id IN (${Prisma.join(checklistTemplateIds)})
        AND is_active IS TRUE
        AND is_published IS TRUE
      FOR UPDATE
    `;

    if (activeChecklistTemplates.length !== checklistTemplateIds.length) {
      throwEquipmentEventBadRequest(
        'CHECKLIST_TEMPLATE_INACTIVE',
        'Можно использовать только активные шаблоны чек-листов.',
      );
    }
  }

  private async assertTemplatesMatchMaintenanceSetting(
    tx: Prisma.TransactionClient,
    params: {
      checklistTemplateIds: number[];
      maintenanceSettingId: number;
    },
  ) {
    const settings = await tx.$queryRaw<
      Array<{
        default_checklist_template_id: number | null;
      }>
    >`
      SELECT default_checklist_template_id
      FROM equipment_maintenance_settings
      WHERE id = ${params.maintenanceSettingId}
      FOR SHARE
    `;
    const setting = settings[0];

    if (!setting?.default_checklist_template_id) {
      throwEquipmentEventBadRequest(
        'CHECKLIST_TEMPLATE_NOT_APPLICABLE',
        'Для настройки обслуживания не задан шаблон чек-листа.',
      );
    }

    if (
      params.checklistTemplateIds.length !== 1 ||
      params.checklistTemplateIds[0] !== setting.default_checklist_template_id
    ) {
      throwEquipmentEventBadRequest(
        'CHECKLIST_TEMPLATE_NOT_APPLICABLE',
        'Шаблон чек-листа не подходит для выбранного вида обслуживания.',
      );
    }
  }

  private assertTemporarySortOrders(
    assignments: EquipmentEventChecklistAssignment[],
    temporarySortOrders?: number[],
  ) {
    if (temporarySortOrders === undefined) {
      return;
    }

    if (temporarySortOrders.length !== assignments.length) {
      throwEquipmentEventBadRequest(
        'CHECKLIST_SORT_ORDER_INVALID',
        'Временный порядок чек-листов должен быть задан для каждого назначения.',
      );
    }

    const uniqueSortOrders = new Set<number>();

    for (const sortOrder of temporarySortOrders) {
      if (!Number.isSafeInteger(sortOrder)) {
        throwEquipmentEventBadRequest(
          'CHECKLIST_SORT_ORDER_INVALID',
          'Временный порядок чек-листов должен быть целым числом.',
        );
      }

      if (uniqueSortOrders.has(sortOrder)) {
        throwEquipmentEventBadRequest(
          'CHECKLIST_SORT_ORDER_DUPLICATE',
          'Временный порядок чек-листов не должен повторяться.',
        );
      }

      uniqueSortOrders.add(sortOrder);
    }
  }
}
