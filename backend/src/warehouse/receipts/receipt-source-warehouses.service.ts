import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { assertTransactionPermission } from '../../auth/transaction-permission';
import { stockId } from '../stock/stock.validation';
import { record, text } from './receipts.validation';
import { receiptConflict } from './receipts.policy';

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
        where: { sourceSystem: code },
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

  save(code: string, value: unknown, actor: string) {
    const b = record(value, ['externalId', 'warehouseId']);
    const externalId = text(b.externalId),
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
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['warehouse:warehouse-link', code, externalId])},0))`;
      const identity = { sourceSystem: code, externalId };
      const previous = await tx.warehouseExternalWarehouse.findUnique({
        where: { sourceSystem_externalId: identity },
      });
      if (previous && previous.warehouseId !== warehouseId)
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
      if (previous) return { externalId, warehouseId: String(warehouseId) };
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
