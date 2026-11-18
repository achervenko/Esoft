import type { Prisma } from '@prisma/client';
import {
  receiptHash,
  type ReceiptImportGroup,
  type ReceiptImportTransaction as Tx,
} from '../receipts/receipts-import.contract';
import type { WarehouseReceiptImportService } from '../receipts/receipt-import.service';
import type {
  Group,
  GroupResult,
  Invoice,
} from './one-c-invoice-document-types';

export function groupPayload(invoice: Invoice, group: Group) {
  return {
    id: group.operationId,
    number: invoice.number,
    date: invoice.date.slice(0, 10),
    status: 'POSTED',
    warehouse: group.warehouse,
    lines: group.lines.map((line) => ({
      id: String(line.rowNumber),
      item: {
        ...line.item,
        type: line.item.type === 'Товар' ? 'GOODS' : line.item.type,
      },
      quantity: line.quantity,
      order: line.order ? { ...line.order, name: '' } : null,
    })),
  };
}

function lineIdentities(
  payload: Prisma.JsonValue | ReturnType<typeof groupPayload>,
) {
  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    !Array.isArray(payload.lines)
  )
    return [];
  const identities = (payload.lines as Prisma.JsonValue[]).map((line) => {
    if (!line || typeof line !== 'object' || Array.isArray(line)) return null;
    const { order, item } = line;
    return {
      row: line.id,
      key: JSON.stringify([
        item && typeof item === 'object' && !Array.isArray(item)
          ? [item.id, item.unit, item.type]
          : null,
        order && typeof order === 'object' && !Array.isArray(order)
          ? order.id
          : null,
      ]),
      quantity: line.quantity,
    };
  });
  const frequencies = new Map<string, number>();
  for (const line of identities)
    if (line) frequencies.set(line.key, (frequencies.get(line.key) ?? 0) + 1);
  // Identical item/order rows cannot be distinguished by their position alone.
  return identities.map((line) =>
    line
      ? [
          line.row,
          line.key,
          (frequencies.get(line.key) ?? 0) > 1 ? line.quantity : null,
        ]
      : null,
  );
}

export function hasStructuralChange(
  previous: ReceiptImportGroup[],
  placed: ReadonlySet<bigint>,
  desired: ReadonlyMap<string, Group>,
  invoice: Invoice,
) {
  return previous.some((receipt) => {
    if (!placed.has(receipt.id)) return false;
    const group = desired.get(receipt.sourceOperationId);
    const payload = group && groupPayload(invoice, group);
    return (
      !payload ||
      receiptHash(lineIdentities(receipt.sourcePayload)) !==
        receiptHash(lineIdentities(payload))
    );
  });
}

export function removedGroups(
  previous: ReceiptImportGroup[],
  desired: ReadonlyMap<string, Group>,
) {
  return previous.filter((receipt) => !desired.has(receipt.sourceOperationId));
}

export async function matchWarehouseGroups(
  importer: WarehouseReceiptImportService,
  tx: Tx,
  sourceCode: string,
  groups: Group[],
  results: GroupResult[],
) {
  const eligible: Group[] = [];
  for (const group of groups.sort((a, b) =>
    a.warehouse.id.localeCompare(b.warehouse.id),
  )) {
    const matches = await importer.lockAndReadWarehouseLinks(
      tx,
      sourceCode,
      group.warehouse.id,
    );
    const [link] = matches;
    const status = !link
      ? 'UNMAPPED'
      : matches.some((row) => row.warehouseId !== link.warehouseId)
        ? 'AMBIGUOUS'
        : !link.isActive
          ? 'INACTIVE'
          : null;
    if (status) results.push(groupResult(group, status));
    else eligible.push(group);
  }
  return eligible;
}

export function groupResult(
  group: Group,
  status: GroupResult['status'],
): GroupResult {
  return {
    operationId: group.operationId,
    warehouseId: group.warehouse.id,
    rows: group.lines.map((line) => line.rowNumber),
    status,
  };
}
