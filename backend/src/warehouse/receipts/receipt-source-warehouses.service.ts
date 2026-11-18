import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { assertTransactionPermission } from '../../auth/transaction-permission';
import { stockId } from '../stock/stock.validation';
import { record, text } from './receipts.validation';
import { receiptConflict } from './receipts.policy';
import {
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
      if (
        !(await tx.integrationSource.findUnique({
          where: { code },
          select: { id: true },
        }))
      )
        throw new NotFoundException();
      const links = await tx.warehouseExternalWarehouse.findMany({
        where: {
          OR: [
            { sourceSystem: code },
            { externalId: { in: await this.uuidLinks(tx) } },
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
        links: links.map((link) => ({
          externalId: link.externalId,
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

  private async uuidLinks(tx: import('./receipts.policy').Tx) {
    const rows = await tx.$queryRaw<{ externalId: string }[]>`
      SELECT external_id AS "externalId" FROM warehouse_external_warehouses
      WHERE external_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'`;
    return rows.map(({ externalId }) => externalId);
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
