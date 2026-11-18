import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { Prisma, CustomerOrder } from '@prisma/client';
import { IntegrationFailure } from '../integrations/integration-errors';
import type { OrderSnapshot } from './orders-snapshot';
export function storedSnapshot(row: CustomerOrder) {
  return {
    externalId: row.externalId,
    number: row.number,
    name: row.name,
    documentDate: row.documentDate,
    status: row.status,
    posted: row.posted,
    deletionMark: row.deletionMark,
    missing: row.missingChecks === 2,
  };
}
export async function applyOrders(
  tx: Prisma.TransactionClient,
  sourceId: string,
  rows: OrderSnapshot[],
  observedAt: Date,
) {
  let changed = 0;
  const receivedIds = new Set<string>();
  const batchSize = 1000;
  const byExternalId = new Map<string, CustomerOrder>();
  const externalIds = [
    ...new Set(rows.map(({ externalId }) => externalId.toLowerCase())),
  ];
  for (let start = 0; start < externalIds.length; start += batchSize) {
    const stored = await tx.customerOrder.findMany({
      where: {
        externalId: { in: externalIds.slice(start, start + batchSize) },
      },
    });
    for (const order of stored) byExternalId.set(order.externalId, order);
  }
  const unchangedIds: string[] = [];
  for (const row of rows) {
    const externalId = row.externalId.toLowerCase();
    const previous = byExternalId.get(externalId);
    const id = previous?.id ?? randomUUID();
    if (receivedIds.has(id))
      throw new IntegrationFailure('ORDERS_RESPONSE_INVALID', false);
    receivedIds.add(id);
    const data = { ...row, externalId };
    const after = { ...data, missing: false };
    const before = previous ? storedSnapshot(previous) : null;
    if (previous && isDeepStrictEqual(before, after)) {
      unchangedIds.push(previous.id);
      continue;
    }
    let saved: CustomerOrder;
    if (previous)
      saved = await tx.customerOrder.update({
        where: { id },
        data: {
          ...data,
          missingChecks: 0,
          checkedAt: observedAt,
          changedAt: observedAt,
        },
      });
    else
      saved = await tx.customerOrder.create({
        data: {
          id,
          sourceId,
          ...data,
          checkedAt: observedAt,
          changedAt: observedAt,
        },
      });
    byExternalId.set(saved.externalId, saved);
    await tx.customerOrderChange.create({
      data: { orderId: id, ...(before ? { before } : {}), after, observedAt },
    });
    changed++;
  }
  for (let start = 0; start < unchangedIds.length; start += batchSize) {
    await tx.customerOrder.updateMany({
      where: {
        id: { in: unchangedIds.slice(start, start + batchSize) },
      },
      data: { checkedAt: observedAt, missingChecks: 0 },
    });
  }
  const candidates = await tx.customerOrder.findMany({
    where: {
      missingChecks: { lt: 2 },
    },
  });
  for (const order of candidates) {
    if (receivedIds.has(order.id)) continue;
    const missingChecks = order.missingChecks + 1;
    const missing = missingChecks === 2;
    await tx.customerOrder.update({
      where: { id: order.id },
      data: { missingChecks, ...(missing ? { changedAt: observedAt } : {}) },
    });
    if (missing) {
      const before = storedSnapshot(order);
      await tx.customerOrderChange.create({
        data: {
          orderId: order.id,
          before,
          after: { ...before, missing },
          observedAt,
        },
      });
      changed++;
    }
  }
  return { received: rows.length, changed };
}
