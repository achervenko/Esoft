import { Prisma } from '@prisma/client';
import { invalid, object, text } from './integration.validation';

function date(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    invalid('Укажите дату в формате ГГГГ-ММ-ДД.');
  const day = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(+day) || day.toISOString().slice(0, 10) !== value)
    invalid('Некорректная дата.');
  return new Date(value + 'T00:00:00+03:00');
}

export async function listIntegrationRuns(
  tx: Prisma.TransactionClient,
  value: unknown,
  available: (code: string) => boolean,
) {
  const query = object(value, [
    'from',
    'to',
    'source',
    'flow',
    'outcome',
    'page',
  ]);
  const from = date(query.from);
  const to = date(query.to);
  if (from > to) invalid('Начальная дата позже конечной.');
  const page = Number(query.page ?? 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000)
    invalid('Некорректная страница.');
  const flow = query.flow === undefined ? undefined : text(query.flow, 100);
  const source =
    query.source === undefined ? undefined : text(query.source, 100);
  const outcome =
    query.outcome === undefined ? undefined : text(query.outcome, 30);
  const end = new Date(+to + 86_400_000);
  const limit = 25;
  const offset = (page - 1) * limit;
  const includes = (code: string) =>
    (!flow || flow === code) && available(code);
  const where = Prisma.sql`
    WHERE r.started_at >= ${from} AND r.started_at < ${end}
      ${source === undefined ? Prisma.empty : Prisma.sql`AND s.code = ${source}`}
      ${outcome === undefined ? Prisma.empty : Prisma.sql`AND r.outcome = ${outcome}`}
  `;
  const branches: Prisma.Sql[] = [];
  if (includes('orders.customers')) {
    branches.push(Prisma.sql`
      SELECT 'orders.customers:' || r.id::text AS id,
        'orders.customers' AS "flowCode", s.name AS "sourceName",
        r.started_at AS "startedAt", r.finished_at AS "finishedAt",
        r.outcome, r.error_code AS "errorCode", r.received, r.changed,
        NULL::int AS processed, NULL::int AS skipped, NULL::int AS errors
      FROM order_sync_runs r JOIN integration_sources s ON s.id = r.source_id
      ${where}
    `);
  }
  if (includes('warehouse.receipts')) {
    branches.push(Prisma.sql`
      SELECT 'warehouse.receipts:' || r.id::text AS id,
        'warehouse.receipts' AS "flowCode", s.name AS "sourceName",
        r.started_at AS "startedAt", r.finished_at AS "finishedAt",
        r.outcome, r.error_code AS "errorCode", r.received, NULL::int AS changed,
        r.processed, r.skipped, r.errors
      FROM warehouse_invoice_sync_runs r JOIN integration_sources s ON s.id = r.source_id
      ${where}
    `);
  }
  if (!branches.length) return { items: [], total: 0, limit };

  const rows = await tx.$queryRaw<
    Array<{
      id: string;
      flowCode: string;
      sourceName: string;
      startedAt: Date;
      finishedAt: Date | null;
      outcome: string;
      errorCode: string | null;
      received: number | null;
      changed: number | null;
      processed: number | null;
      skipped: number | null;
      errors: number | null;
      total: bigint;
    }>
  >`
    SELECT runs.*, count(*) OVER () AS total
    FROM (${Prisma.join(branches, ' UNION ALL ')}) runs
    ORDER BY "startedAt" DESC, id
    LIMIT ${limit} OFFSET ${offset}
  `;
  return {
    items: rows.map(({ total: _total, ...row }) => row),
    total: Math.min(Number(rows[0]?.total ?? 0), 1000 * limit),
    limit,
  };
}
