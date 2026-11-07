import { IntegrationFailure } from '../integrations/integration-errors';
import type { IntegrationHttpClient } from '../integrations/integration.contracts';
import { ORDERS_MAX_PAGES, ORDERS_PAGE_SIZE } from './orders.constants';
export type OrderSnapshot = {
  externalId: string | null;
  number: string;
  name: string;
  documentDate: string;
  status: string;
  posted: boolean;
  deletionMark: boolean;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid = (): never => {
  throw new IntegrationFailure('ORDERS_RESPONSE_INVALID', false);
};
function text(value: unknown, max: number, empty = false): string {
  if (
    typeof value !== 'string' ||
    value.length > max ||
    value.includes('\0') ||
    (!empty && !value.trim())
  )
    invalid();
  return value as string;
}
export function orderSnapshot(
  value: unknown,
): OrderSnapshot & { externalId: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const r = value as Record<string, unknown>;
  const externalId = text(r.Ref_Key, 36).toLowerCase();
  const documentDate = text(r.Date, 19);
  if (
    !uuid.test(externalId) ||
    externalId === '00000000-0000-0000-0000-000000000000' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(documentDate) ||
    !Number.isFinite(Date.parse(documentDate + 'Z')) ||
    new Date(documentDate + 'Z').toISOString().slice(0, 19) !== documentDate ||
    typeof r.Posted !== 'boolean' ||
    typeof r.DeletionMark !== 'boolean'
  )
    invalid();
  return {
    externalId,
    number: text(r.Number, 100),
    name: text(r.IR_Проект, 1000, true),
    documentDate,
    status: text(r.Статус, 100),
    posted: r.Posted as boolean,
    deletionMark: r.DeletionMark as boolean,
  };
}
export function ordersCollection(config: unknown): string {
  if (!config || typeof config !== 'object' || Array.isArray(config)) invalid();
  const r = config as Record<string, unknown>;
  if (
    Object.keys(r).some(
      (k) => k !== 'collectionPath' && k !== 'previousSourceId',
    )
  )
    invalid();
  ordersPreviousSourceId(r);
  const path = r.collectionPath ?? 'Document_ЗаказКлиента';
  if (
    typeof path !== 'string' ||
    path.length > 500 ||
    !/^[a-zA-Zа-яА-ЯёЁ0-9_/-]+$/.test(path) ||
    path.startsWith('/') ||
    path.endsWith('/')
  )
    invalid();
  return path as string;
}
export function ordersPreviousSourceId(config: unknown): string | undefined {
  const id = (config as Record<string, unknown>).previousSourceId;
  if (id === undefined) return;
  if (typeof id === 'string' && uuid.test(id)) return id.toLowerCase();
  return invalid();
}
export async function readOrders(
  client: IntegrationHttpClient,
  path: string,
  signal?: AbortSignal,
) {
  const result: OrderSnapshot[] = [],
    seen = new Set<string>();
  for (let page = 0; page < ORDERS_MAX_PAGES; page++) {
    const q = new URLSearchParams({
      $format: 'json',
      $select: 'Ref_Key,Number,IR_Проект,Date,Статус,Posted,DeletionMark',
      $orderby: 'Ref_Key asc',
      $top: String(ORDERS_PAGE_SIZE),
      $skip: String(result.length),
    });
    const response = await client.getJson(`${path}?${q}`, signal);
    if (!response || typeof response !== 'object' || Array.isArray(response))
      invalid();
    const body = response as Record<string, unknown>;
    if (!Array.isArray(body.value) || body.value.length > ORDERS_PAGE_SIZE)
      invalid();
    // A different server-driven pagination contract must not silently truncate the mirror.
    if (body['odata.nextLink'] || body['@odata.nextLink'] || body['__next'])
      throw new IntegrationFailure('ORDERS_PAGINATION_UNSUPPORTED', false);
    const values = body.value as unknown[];
    if (!values.length) return result;
    for (const raw of values) {
      const row = orderSnapshot(raw);
      if (seen.has(row.externalId)) invalid();
      seen.add(row.externalId);
      result.push(row);
    }
  }
  throw new IntegrationFailure('ORDERS_RESPONSE_LIMIT', false);
}
