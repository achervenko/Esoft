import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { assertTransactionPermission } from '../../auth/transaction-permission';
import { stockId } from '../stock/stock.validation';
import { record, text } from './receipts.validation';
import { receiptConflict } from './receipts.policy';
import {
  externalOneCUuid,
  findReceiptWarehouseLinks,
  lockReceiptWarehouseLink,
  receiptWarehouseExternalId,
} from './receipt-warehouse-links';

@Injectable()
export class ReceiptIntegrationWarehousesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  list(code: string, actor: string) {
    return this.prisma.$transaction(async (tx) => {
      await assertTransactionPermission(tx, actor, 'integrations.manage');
      const source = await tx.integrationSource.findUnique({
        where: { code },
        select: { id: true },
      });
      if (!source) throw new NotFoundException();
      const observed = await tx.$queryRaw<
        { externalId: string; name: string }[]
      >`
        SELECT DISTINCT ON (warehouse->>'id')
          warehouse->>'id' AS "externalId", warehouse->>'name' AS name
        FROM warehouse_invoice_snapshots snapshot
        CROSS JOIN LATERAL jsonb_array_elements(snapshot.payload->'lines') line
        CROSS JOIN LATERAL (SELECT line->'warehouse' AS warehouse) data
        WHERE snapshot.source_id=${source.id}::uuid
          AND line->'item'->>'type' = 'Товар'
          AND warehouse->>'id' <> '' AND warehouse->>'name' <> ''
        ORDER BY warehouse->>'id', snapshot.observed_at DESC, snapshot.invoice_id
      `;
      const observedUuids = observed
        .map(({ externalId }) => externalId)
        .filter((externalId) => externalOneCUuid.test(externalId));
      const links = await tx.warehouseExternalWarehouse.findMany({
        where: {
          OR: [
            { sourceSystem: code },
            { externalId: { in: observedUuids, mode: 'insensitive' } },
          ],
        },
        include: { warehouse: true },
        orderBy: { externalId: 'asc' },
      });
      const warehouses = await tx.warehouse.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      });
      return {
        observed: observed.map((warehouse) => ({
          ...warehouse,
          externalId: receiptWarehouseExternalId(warehouse.externalId),
        })),
        links: links.map((link) => ({
          externalId: receiptWarehouseExternalId(link.externalId),
          warehouseId: String(link.warehouseId),
          warehouseName: link.warehouse.name,
          isActive: link.warehouse.isActive,
        })),
        warehouses: warehouses.map((warehouse) => ({
          ...warehouse,
          id: String(warehouse.id),
        })),
      };
    });
  }

  save(code: string, value: unknown, actor: string) {
    const b = record(value, ['externalId', 'warehouseId']);
    const externalId = receiptWarehouseExternalId(text(b.externalId)),
      warehouseId = stockId(b.warehouseId, 'warehouseId');
    return this.prisma.$transaction(async (tx) => {
      await assertTransactionPermission(tx, actor, 'integrations.manage');
      await tx.$queryRaw`SELECT id FROM integration_sources WHERE code=${code} FOR UPDATE`;
      if (
        !(await tx.integrationSource.findUnique({
          where: { code },
          select: { id: true },
        }))
      )
        throw new NotFoundException();
      await lockReceiptWarehouseLink(tx, code, externalId);
      const identity = { sourceSystem: code, externalId };
      const previous = await findReceiptWarehouseLinks(tx, code, externalId);
      if (previous.some((link) => link.warehouseId !== warehouseId))
        receiptConflict(
          'WAREHOUSE_RECEIPT_MAPPING_CONFLICT',
          'Склад 1С уже связан с другим складом ESoft.',
        );
      const warehouse = await tx.warehouse.findUnique({
        where: { id: warehouseId },
      });
      if (!warehouse) throw new NotFoundException();
      if (!warehouse.isActive)
        receiptConflict('WAREHOUSE_INACTIVE', 'Склад ESoft выключен.');
      if (previous.length)
        return { externalId, warehouseId: String(warehouseId) };
      await tx.warehouseExternalWarehouse.create({
        data: { ...identity, warehouseId, confirmedBy: actor },
      });
      await this.audit.writeFieldChanges({
        tx,
        userId: actor,
        module: 'USERS',
        action: 'CREATE',
        entityType: 'integration_warehouse_link',
        entityStringId: code + ':' + externalId,
        fields: [
          {
            fieldName: 'Сопоставление склада 1С',
            newValue: { externalId, warehouseId: String(warehouseId) },
          },
        ],
      });
      return { externalId, warehouseId: String(warehouseId) };
    });
  }
}
