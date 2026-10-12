import { Prisma } from '@prisma/client';
import { BUSINESS_TIME_ZONE } from '../application/business-date';

// Same whitespace characters as JavaScript String.trim().
const whitespace =
  '[\u0009-\u000d\u0020\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]';
const blank = (value: Prisma.Sql) =>
  Prisma.sql`regexp_replace(coalesce(${value}, ''), ${whitespace}, '', 'g') = ''`;

const rules: Array<[string, Prisma.Sql]> = [
  ['Название оборудования', blank(Prisma.sql`e.name`)],
  ['Инвентарный номер', blank(Prisma.sql`e.inventory_number`)],
  ['Производитель', Prisma.sql`coalesce(model.manufacturer_id, 0) = 0`],
  ['Модель', Prisma.sql`coalesce(e.model_id, 0) = 0`],
  ['Серийный номер', blank(Prisma.sql`e.serial_number`)],
  ['Технические характеристики', blank(Prisma.sql`e.specifications`)],
  ['Страна', Prisma.sql`coalesce(e.country_id, 0) = 0`],
  ['Год изготовления', Prisma.sql`coalesce(e.manufacture_year, 0) = 0`],
  ['Дата ввода в эксплуатацию', Prisma.sql`e.commissioning_date IS NULL`],
  ['Дата выдачи', Prisma.sql`e.issue_date IS NULL`],
  ['Местонахождение', Prisma.sql`coalesce(e.section_id, 0) = 0`],
  ['Ответственный', Prisma.sql`coalesce(e.responsible_employee_id, 0) = 0`],
  ['Статус', blank(Prisma.sql`e.status::text`)],
  ['Эксплуатация', blank(Prisma.sql`e.operation_text`)],
];

export const EQUIPMENT_CONTROLLED_FIELDS_COUNT = rules.length;

export type EquipmentProgressSummary = {
  createdCount: number;
  incompleteCardsCount: number;
  filledFieldsCount: number;
  incompleteEquipment: Array<{
    visibleId: number;
    name: string;
    missingFields: string[];
  }>;
  recentDailyCounts: Array<{ date: string; count: number }>;
};

export function equipmentProgressQuery(periodStart: Date, periodEnd: Date) {
  return Prisma.sql`
    WITH cards AS MATERIALIZED (
      SELECT e.visible_id, e.name,
        array_remove(ARRAY[${Prisma.join(rules.map(([label, missing]) => Prisma.sql`CASE WHEN ${missing} THEN ${label}::text END`))}], NULL) AS missing_fields
      FROM equipment e LEFT JOIN equipment_models model ON model.id = e.model_id
    ), totals AS (
      SELECT count(*)::int AS created_count,
        count(*) FILTER (WHERE cardinality(missing_fields) > 0)::int AS incomplete_count,
        coalesce(sum(${rules.length} - cardinality(missing_fields)), 0)::int AS filled_count
      FROM cards
    ), examples AS (
      SELECT visible_id, name, missing_fields FROM cards
      WHERE cardinality(missing_fields) > 0 ORDER BY visible_id LIMIT 10
    ), daily AS (
      SELECT to_char(created_at AT TIME ZONE ${BUSINESS_TIME_ZONE}, 'YYYY-MM-DD') AS date,
        count(DISTINCT entity_id)::int AS count
      FROM audit_log
      WHERE action = 'CREATE' AND module = 'equipment' AND entity_type = 'equipment'
        AND entity_id IS NOT NULL AND entity_id <> 0
        AND created_at >= ${periodStart} AND created_at < ${periodEnd}
      GROUP BY 1
    )
    SELECT created_count AS "createdCount", incomplete_count AS "incompleteCardsCount", filled_count AS "filledFieldsCount",
      coalesce((SELECT jsonb_agg(jsonb_build_object('visibleId', visible_id, 'name', name, 'missingFields', missing_fields) ORDER BY visible_id) FROM examples), '[]'::jsonb) AS "incompleteEquipment",
      coalesce((SELECT jsonb_agg(jsonb_build_object('date', date, 'count', count) ORDER BY date) FROM daily), '[]'::jsonb) AS "recentDailyCounts"
    FROM totals
  `;
}
