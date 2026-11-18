import type { Tx } from './receipts.policy';

import {
  externalOneCUuid,
  normalizeWarehouseExternalId,
} from '../warehouse-external-identity';
export {
  externalOneCUuid,
  normalizeWarehouseExternalId as receiptWarehouseExternalId,
} from '../warehouse-external-identity';

export async function lockReceiptWarehouseLink(
  tx: Tx,
  sourceCode: string,
  externalId: string,
) {
  const key = JSON.stringify([
    'warehouse:warehouse-link',
    externalOneCUuid.test(externalId) ? 'ONE_C' : sourceCode,
    normalizeWarehouseExternalId(externalId),
  ]);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))`;
}

export async function findReceiptWarehouseLinks(
  tx: Tx,
  sourceCode: string,
  externalId: string,
) {
  const normalized = normalizeWarehouseExternalId(externalId);
  // Legacy non-UUID keys keep their exact-match semantics.
  const caseInsensitive = externalOneCUuid.test(externalId);
  return tx.$queryRaw<{ warehouseId: bigint; isActive: boolean }[]>`
    SELECT link.warehouse_id AS "warehouseId", w.is_active AS "isActive"
    FROM warehouse_external_warehouses link JOIN warehouses w ON w.id=link.warehouse_id
    WHERE (${caseInsensitive} OR link.source_system=${sourceCode})
      AND CASE WHEN ${caseInsensitive} THEN lower(link.external_id)=${normalized}
               ELSE link.external_id=${externalId} END
    FOR SHARE OF link, w`;
}
