import { Prisma } from '@prisma/client';
import { parseIssueListQuery } from './ppe-issues.validation';
import { badPpeRequest, parsePpeObject } from './ppe.validation';
import type { PrismaService } from '../prisma/prisma.service';
import { toPpeIssueDto } from './ppe-issues.mapper';

export function parseJournalQuery(payload: unknown) {
  const values = parsePpeObject(payload, [
    'employeeId',
    'positionId',
    'ppeItemId',
    'issueType',
    'status',
    'dateFrom',
    'dateTo',
    'page',
    'limit',
    'search',
    'sort',
    'direction',
  ]);
  const {
    page: rawPage,
    limit: rawLimit,
    search,
    sort = 'date',
    direction = 'desc',
    ...filters
  } = values;
  const integer = (value: unknown, fallback: number, max: number) => {
    if (value === undefined) return fallback;
    if (
      typeof value !== 'string' ||
      !/^[1-9]\d*$/.test(value) ||
      !Number.isSafeInteger(Number(value)) ||
      Number(value) > max
    )
      badPpeRequest('INVALID_PAGE', 'Некорректные параметры страницы.');
    return Number(value);
  };
  const page = integer(rawPage, 1, 1000000);
  const limit = integer(rawLimit, 100, 100);
  if (
    search !== undefined &&
    (typeof search !== 'string' || search.length > 200)
  )
    badPpeRequest(
      'INVALID_SEARCH',
      'Поисковый запрос должен быть строкой до 200 символов.',
    );
  if (direction !== 'asc' && direction !== 'desc')
    badPpeRequest('INVALID_SORT', 'Некорректное направление сортировки.');
  const size = Prisma.sql`coalesce(nullif(concat_ws('; ', nullif(size_value, ''), nullif(height_snapshot, '')), ''), 'Без размера')`;
  const columns: Record<string, Prisma.Sql> = {
    date: Prisma.sql`issued_at`,
    employee: Prisma.sql`lower(employee_name_snapshot) COLLATE app_registry_order`,
    type: Prisma.sql`issue_type::text`,
    actual: Prisma.sql`lower(ppe_name_snapshot) COLLATE app_registry_order`,
    quantity: Prisma.sql`quantity`,
    size: Prisma.sql`lower(${size}) COLLATE app_registry_order`,
  };
  if (typeof sort !== 'string' || !Object.hasOwn(columns, sort))
    badPpeRequest('INVALID_SORT', 'Некорректное поле сортировки.');
  const filter = parseIssueListQuery(filters);
  const conditions: Prisma.Sql[] = [];
  for (const [column, value] of [
    [Prisma.sql`employee_id`, filter.employeeId],
    [Prisma.sql`position_id`, filter.positionId],
    [Prisma.sql`ppe_item_id`, filter.ppeItemId],
  ] as const) {
    if (value !== undefined) conditions.push(Prisma.sql`${column} = ${value}`);
  }
  if (filter.issueType)
    conditions.push(Prisma.sql`issue_type::text = ${filter.issueType}`);
  if (filter.status)
    conditions.push(Prisma.sql`status::text = ${filter.status}`);
  if (filter.dateFrom)
    conditions.push(Prisma.sql`issued_at >= ${filter.dateFrom}`);
  if (filter.dateTo) conditions.push(Prisma.sql`issued_at <= ${filter.dateTo}`);
  const text = Prisma.sql`journal_search_text`;
  const words =
    typeof search === 'string'
      ? search
          .toLowerCase()
          .replaceAll('ё', 'е')
          .trim()
          .split(/\s+/)
          .filter(Boolean)
      : [];
  for (const word of words)
    conditions.push(
      Prisma.sql`${text} LIKE ${'%' + word.replace(/[\\%_]/g, '\\$&') + '%'} ESCAPE '\\'`,
    );
  return {
    page,
    limit,
    where: conditions.length
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty,
    order: Prisma.sql`${columns[sort]} ${direction === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`}, id DESC`,
  };
}

export async function loadJournalPage(prisma: PrismaService, payload: unknown) {
  const { page, limit, where, order } = parseJournalQuery(payload);
  return prisma.$transaction(
    async (tx) => {
      const counts = await tx.$queryRaw<Array<{ total: bigint }>>(
        Prisma.sql`SELECT count(*) AS total FROM ppe_issues ${where}`,
      );
      const total = Number(counts[0].total);
      const skip = (page - 1) * limit;
      if (skip >= total) return { items: [], total, page, limit };
      const ids = await tx.$queryRaw<Array<{ id: number }>>(
        Prisma.sql`SELECT id FROM ppe_issues ${where} ORDER BY ${order} LIMIT ${limit} OFFSET ${skip}`,
      );
      if (ids.length === 0) return { items: [], total, page, limit };
      const issues = await tx.ppeIssue.findMany({
        where: { id: { in: ids.map(({ id }) => id) } },
      });
      const byId = new Map(
        issues.map((item) => [item.id, toPpeIssueDto(item)]),
      );
      return {
        items: ids.flatMap(({ id }) => {
          const item = byId.get(id);
          return item ? [item] : [];
        }),
        total,
        page,
        limit,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
