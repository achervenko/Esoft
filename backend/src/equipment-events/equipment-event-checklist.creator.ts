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
    },
  ) {
    this.assertUniqueChecklistTemplateAssignments(params.assignments);

    const assignmentsJson = JSON.stringify(params.assignments);

    const [creationState] = await tx.$queryRaw<
      Array<{
        assignmentCount: bigint;
        eventCount: bigint;
        eventResponsibleAssignmentCount: bigint;
        matchedSettingTemplateCount: bigint;
        settingTemplateCount: bigint;
      }>
    >`
      WITH equipment_event AS (
        SELECT id, equipment_id, maintenance_setting_id
        FROM equipment_events
        WHERE id = ${params.eventId}
        FOR UPDATE
      ),
      checklist_assignment AS (
        SELECT
          assignment."checklistTemplateId" AS checklist_template_id,
          assignment."assignedUserId" AS assigned_user_id
        FROM jsonb_to_recordset(${assignmentsJson}::jsonb)
          AS assignment(
            "checklistTemplateId" INTEGER,
            "assignedUserId" TEXT
          )
      ),
      setting_template AS (
        SELECT setting_template.*
        FROM equipment_event
        JOIN equipment_maintenance_setting_checklist_templates setting_template
          ON setting_template.maintenance_setting_id =
            equipment_event.maintenance_setting_id
      ),
      assignment_state AS (
        SELECT
          (
            SELECT COUNT(*)::bigint
            FROM equipment_event
          ) AS event_count,
          (
            SELECT COUNT(*)::bigint
            FROM checklist_assignment
          ) AS assignment_count,
          (
            SELECT COUNT(*)::bigint
            FROM setting_template
          ) AS setting_template_count,
          (
            SELECT COUNT(*)::bigint
            FROM checklist_assignment
            JOIN setting_template
              ON setting_template.checklist_template_id =
                checklist_assignment.checklist_template_id
          ) AS matched_setting_template_count,
          (
            SELECT COUNT(*)::bigint
            FROM checklist_assignment
            JOIN equipment_event_responsibles responsible
              ON responsible.equipment_event_id = ${params.eventId}
              AND responsible.user_id = checklist_assignment.assigned_user_id
          ) AS event_responsible_assignment_count
      ),
      created_checklists AS (
        INSERT INTO checklists (
          equipment_event_id,
          equipment_id,
          checklist_template_id,
          assigned_user_id,
          is_required,
          sort_order,
          created_by
        )
        SELECT
          equipment_event.id,
          equipment_event.equipment_id,
          setting_template.checklist_template_id,
          checklist_assignment.assigned_user_id,
          setting_template.is_required,
          setting_template.sort_order,
          ${params.createdBy}
        FROM assignment_state
        JOIN equipment_event
          ON TRUE
        JOIN setting_template
          ON TRUE
        JOIN checklist_assignment
          ON checklist_assignment.checklist_template_id =
            setting_template.checklist_template_id
        WHERE assignment_state.event_count = 1
          AND assignment_state.assignment_count =
            assignment_state.setting_template_count
          AND assignment_state.matched_setting_template_count =
            assignment_state.setting_template_count
          AND assignment_state.event_responsible_assignment_count =
            assignment_state.assignment_count
        ON CONFLICT (equipment_event_id, checklist_template_id) DO NOTHING
        RETURNING id, checklist_template_id
      ),
      created_details AS (
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
          created_checklist.id,
          template_question.id,
          template_question.checklist_question_id,
          template_module.module_name_snapshot,
          template_module.sort_order,
          template_question.question_text_snapshot,
          template_question.answer_type_snapshot,
          template_question.sort_order,
          template_question.is_required
        FROM created_checklists created_checklist
        JOIN checklist_template_modules template_module
          ON template_module.checklist_template_id =
            created_checklist.checklist_template_id
        JOIN checklist_template_questions template_question
          ON template_question.checklist_template_module_id =
            template_module.id
        RETURNING id
      )
      SELECT
        event_count AS "eventCount",
        assignment_count AS "assignmentCount",
        setting_template_count AS "settingTemplateCount",
        matched_setting_template_count AS "matchedSettingTemplateCount",
        event_responsible_assignment_count AS "eventResponsibleAssignmentCount"
      FROM assignment_state
    `;

    this.assertCreationState(creationState);
  }

  private assertUniqueChecklistTemplateAssignments(
    assignments: EquipmentEventChecklistAssignment[],
  ) {
    const checklistTemplateIds = new Set<number>();

    for (const assignment of assignments) {
      if (checklistTemplateIds.has(assignment.checklistTemplateId)) {
        throwEquipmentEventBadRequest(
          'CHECKLIST_ASSIGNMENT_DUPLICATE',
          'Шаблон чек-листа назначен несколько раз.',
        );
      }

      checklistTemplateIds.add(assignment.checklistTemplateId);
    }
  }

  private assertCreationState(
    creationState:
      | {
          assignmentCount: bigint;
          eventCount: bigint;
          eventResponsibleAssignmentCount: bigint;
          matchedSettingTemplateCount: bigint;
          settingTemplateCount: bigint;
        }
      | undefined,
  ) {
    if (!creationState) {
      throwEquipmentEventBadRequest(
        'CHECKLIST_ASSIGNMENT_TEMPLATE_INVALID',
        'Некорректные назначения чек-листов.',
      );
    }

    if (creationState.eventCount !== 1n) {
      throwEquipmentEventNotFound(
        'EVENT_NOT_FOUND',
        'Событие оборудования не найдено.',
      );
    }

    if (
      creationState.assignmentCount !== creationState.settingTemplateCount ||
      creationState.matchedSettingTemplateCount !==
        creationState.settingTemplateCount
    ) {
      throwEquipmentEventBadRequest(
        'CHECKLIST_ASSIGNMENTS_INCOMPLETE',
        'Назначьте исполнителей для всех чек-листов настройки события.',
      );
    }

    if (
      creationState.eventResponsibleAssignmentCount !==
      creationState.assignmentCount
    ) {
      throwEquipmentEventBadRequest(
        'CHECKLIST_ASSIGNED_USER_NOT_RESPONSIBLE',
        'Исполнитель чек-листа должен быть ответственным за событие.',
      );
    }
  }
}
