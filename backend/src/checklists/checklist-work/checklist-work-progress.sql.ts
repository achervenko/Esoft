import { Prisma } from '@prisma/client';

export function checklistProgressSelectFields() {
  return Prisma.sql`
    COUNT(*)::bigint AS total,
    COUNT(*) FILTER (
      WHERE detail.answer_boolean IS NOT NULL
        OR detail.answer_integer IS NOT NULL
        OR detail.answer_decimal IS NOT NULL
        OR detail.answer_text IS NOT NULL
        OR detail.answer_date IS NOT NULL
    )::bigint AS answered,
    COUNT(*) FILTER (WHERE detail.is_required IS TRUE)::bigint AS "requiredTotal",
    COUNT(*) FILTER (
      WHERE detail.is_required IS TRUE
        AND (
          detail.answer_boolean IS NOT NULL
          OR detail.answer_integer IS NOT NULL
          OR detail.answer_decimal IS NOT NULL
          OR detail.answer_text IS NOT NULL
          OR detail.answer_date IS NOT NULL
        )
    )::bigint AS "requiredAnswered"
  `;
}

export function checklistProgressGroupedByChecklistSql() {
  return Prisma.sql`
    SELECT
      detail.checklist_id,
      ${checklistProgressSelectFields()}
    FROM checklist_details detail
    GROUP BY detail.checklist_id
  `;
}
