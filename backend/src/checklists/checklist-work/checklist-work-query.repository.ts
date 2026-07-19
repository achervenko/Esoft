import { Injectable } from '@nestjs/common';
import { ChecklistStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { checklistProgressGroupedByChecklistSql } from './checklist-work-progress.sql';
import type {
  ChecklistDetailQuestionRow,
  ChecklistDetailRow,
  ChecklistListRow,
} from './checklist-work.repository.types';
import type { ChecklistWorkQuery } from './checklist-work.types';

@Injectable()
export class ChecklistWorkQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: {
    query: ChecklistWorkQuery;
    userId: string;
  }) {
    const [rows, totalRows] = await Promise.all([
      this.prisma.$queryRaw<ChecklistListRow[]>`
        WITH checklist_progress AS (
          ${checklistProgressGroupedByChecklistSql()}
        ),
        filtered_checklists AS (
          SELECT
            checklist.id,
            checklist.version,
            checklist.status,
            checklist.sort_order AS "sortOrder",
            checklist.checklist_template_id AS "checklistTemplateId",
            checklist.assigned_user_id AS "assignedUserId",
            COALESCE(
              NULLIF(
                TRIM(
                  CONCAT_WS(' ', assigned_employee.last_name, assigned_employee.first_name, assigned_employee.middle_name)
                ),
                ''
              ),
              assigned_user.name
            ) AS "assignedUserFullName",
            COALESCE(assigned_employee.position, '') AS "assignedUserPosition",
            template.name AS "templateName",
            event.id AS "eventId",
            event.status AS "eventStatus",
            event.planned_date AS "eventPlannedDate",
            event_type.id AS "maintenanceTypeId",
            event_type.name AS "maintenanceTypeName",
            equipment.visible_id AS "equipmentVisibleId",
            equipment.name AS "equipmentName",
            equipment_model.name AS "equipmentModelName",
            COALESCE(progress.total, 0)::bigint AS total,
            COALESCE(progress.answered, 0)::bigint AS answered,
            COALESCE(progress."requiredTotal", 0)::bigint AS "requiredTotal",
            COALESCE(progress."requiredAnswered", 0)::bigint AS "requiredAnswered"
          FROM checklists checklist
          JOIN equipment_events event
            ON event.id = checklist.equipment_event_id
          JOIN equipment_event_types event_type
            ON event_type.id = event.event_type_id
          JOIN equipment
            ON equipment.id = event.equipment_id
          JOIN equipment_models equipment_model
            ON equipment_model.id = equipment.model_id
          JOIN checklist_templates template
            ON template.id = checklist.checklist_template_id
          JOIN "user" assigned_user
            ON assigned_user.id = checklist.assigned_user_id
          LEFT JOIN employee_users assigned_employee_user
            ON assigned_employee_user.user_id = assigned_user.id
          LEFT JOIN employees assigned_employee
            ON assigned_employee.id = assigned_employee_user.employee_id
          LEFT JOIN checklist_progress progress
            ON progress.checklist_id = checklist.id
          WHERE checklist.assigned_user_id = ${params.userId}
            AND checklist.status = ANY(ARRAY[${Prisma.join(
              params.query.statuses ?? [
                ChecklistStatus.CREATED,
                ChecklistStatus.IN_PROGRESS,
              ],
            )}]::checklist_status[])
            AND (${params.query.equipmentVisibleId ?? null}::int IS NULL OR equipment.visible_id = ${params.query.equipmentVisibleId ?? null})
            AND (${params.query.eventId ?? null}::int IS NULL OR event.id = ${params.query.eventId ?? null})
            AND (${params.query.dateFrom ?? null}::date IS NULL OR event.planned_date >= ${params.query.dateFrom ?? null})
            AND (${params.query.dateTo ?? null}::date IS NULL OR event.planned_date <= ${params.query.dateTo ?? null})
        )
        SELECT *
        FROM filtered_checklists
        ORDER BY "eventPlannedDate" ASC NULLS LAST, "eventId" ASC, "sortOrder" ASC, id ASC
        LIMIT ${params.query.limit}
        OFFSET ${params.query.offset}
      `,
      this.prisma.$queryRaw<Array<{ total: bigint }>>`
        SELECT COUNT(*)::bigint AS total
        FROM checklists checklist
        JOIN equipment_events event
          ON event.id = checklist.equipment_event_id
        JOIN equipment
          ON equipment.id = event.equipment_id
        WHERE checklist.assigned_user_id = ${params.userId}
          AND checklist.status = ANY(ARRAY[${Prisma.join(
            params.query.statuses ?? [
              ChecklistStatus.CREATED,
              ChecklistStatus.IN_PROGRESS,
            ],
          )}]::checklist_status[])
          AND (${params.query.equipmentVisibleId ?? null}::int IS NULL OR equipment.visible_id = ${params.query.equipmentVisibleId ?? null})
          AND (${params.query.eventId ?? null}::int IS NULL OR event.id = ${params.query.eventId ?? null})
          AND (${params.query.dateFrom ?? null}::date IS NULL OR event.planned_date >= ${params.query.dateFrom ?? null})
          AND (${params.query.dateTo ?? null}::date IS NULL OR event.planned_date <= ${params.query.dateTo ?? null})
      `,
    ]);

    return {
      rows,
      total: Number(totalRows[0]?.total ?? 0),
    };
  }

  async loadDetailForAccess(checklistId: number) {
    const [row] = await this.prisma.$queryRaw<
      Array<
        ChecklistDetailRow & {
          assignedUserId: string;
          responsibleUserIds: string[];
        }
      >
    >`
      ${this.detailBaseQuery()}
      WHERE checklist.id = ${checklistId}
    `;

    return row ?? null;
  }

  async loadDetailQuestions(checklistId: number) {
    return this.prisma.$queryRaw<ChecklistDetailQuestionRow[]>`
      SELECT
        detail.id AS "checklistDetailId",
        detail.checklist_question_id AS "checklistQuestionId",
        detail.module_name AS "moduleName",
        detail.module_sort_order AS "moduleSortOrder",
        detail.question_text AS "questionText",
        detail.answer_type AS "answerType",
        detail.question_sort_order AS "questionSortOrder",
        detail.is_required AS "isRequired",
        detail.answer_boolean AS "answerBoolean",
        detail.answer_integer AS "answerInteger",
        detail.answer_decimal AS "answerDecimal",
        detail.answer_text AS "answerText",
        detail.answer_date AS "answerDate",
        detail.answered_at AS "answeredAt"
      FROM checklist_details detail
      WHERE detail.checklist_id = ${checklistId}
      ORDER BY detail.module_sort_order ASC, detail.question_sort_order ASC, detail.id ASC
    `;
  }

  private detailBaseQuery() {
    return Prisma.sql`
      SELECT
        checklist.id,
        checklist.status,
        checklist.version,
        checklist.started_at AS "startedAt",
        checklist.completed_at AS "completedAt",
        checklist.assigned_user_id AS "assignedUserId",
        checklist.sort_order AS "sortOrder",
        checklist.checklist_template_id AS "checklistTemplateId",
        COALESCE(
          NULLIF(
            TRIM(
              CONCAT_WS(' ', assigned_employee.last_name, assigned_employee.first_name, assigned_employee.middle_name)
            ),
            ''
          ),
          assigned_user.name
        ) AS "assignedUserFullName",
        COALESCE(assigned_employee.position, '') AS "assignedUserPosition",
        template.name AS "templateName",
        event.id AS "eventId",
        event.status AS "eventStatus",
        event.planned_date AS "eventPlannedDate",
        event_type.id AS "maintenanceTypeId",
        event_type.name AS "maintenanceTypeName",
        equipment.visible_id AS "equipmentVisibleId",
        equipment.name AS "equipmentName",
        equipment_model.name AS "equipmentModelName",
        COALESCE(progress.total, 0)::bigint AS total,
        COALESCE(progress.answered, 0)::bigint AS answered,
        COALESCE(progress."requiredTotal", 0)::bigint AS "requiredTotal",
        COALESCE(progress."requiredAnswered", 0)::bigint AS "requiredAnswered",
        COALESCE(responsibles.user_ids, ARRAY[]::text[]) AS "responsibleUserIds"
      FROM checklists checklist
      JOIN equipment_events event
        ON event.id = checklist.equipment_event_id
      JOIN equipment_event_types event_type
        ON event_type.id = event.event_type_id
      JOIN equipment
        ON equipment.id = event.equipment_id
      JOIN equipment_models equipment_model
        ON equipment_model.id = equipment.model_id
      JOIN checklist_templates template
        ON template.id = checklist.checklist_template_id
      JOIN "user" assigned_user
        ON assigned_user.id = checklist.assigned_user_id
      LEFT JOIN employee_users assigned_employee_user
        ON assigned_employee_user.user_id = assigned_user.id
      LEFT JOIN employees assigned_employee
        ON assigned_employee.id = assigned_employee_user.employee_id
      LEFT JOIN (
        ${checklistProgressGroupedByChecklistSql()}
      ) progress
        ON progress.checklist_id = checklist.id
      LEFT JOIN (
        SELECT
          equipment_event_id,
          array_agg(user_id) AS user_ids
        FROM equipment_event_responsibles
        GROUP BY equipment_event_id
      ) responsibles
        ON responsibles.equipment_event_id = event.id
    `;
  }
}
