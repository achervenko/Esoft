import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, AuditModule, Prisma } from '@prisma/client';
import { hasPermission } from '../../auth/permission-policy';
import { AuditLogService } from '../../audit/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WarehouseStockService } from '../stock/stock.service';
import { stockId } from '../stock/stock.validation';
import { lockWarehouse } from '../storage-structure/storage-structure.policy';
import {
  invalid,
  optionalText,
  orderedLines,
  parseManualReceipt,
  parseReceipt,
  receiptHash,
} from './receipts.validation';
import { receiptDto, receiptInclude } from './receipts.mapper';

export type ReceiptOrigin = {
  source: 'MANUAL' | 'ONE_C';
  sourceSystem: string;
  sourceOperationId: string;
};
@Injectable()
export class WarehouseReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: WarehouseStockService,
    private readonly audit: AuditLogService,
  ) {}
  createManual(value: unknown, actor: string) {
    const { input, requestKey } = parseManualReceipt(value);
    return this.post(
      {
        ...input,
        lines: input.lines.map(({ itemId, storageLocationId, quantity }) => ({
          itemId,
          storageLocationId,
          quantity,
        })),
      },
      {
        source: 'MANUAL',
        sourceSystem: 'ESOFT',
        sourceOperationId: JSON.stringify([actor, requestKey]),
      },
      actor,
    );
  }
  // Trusted backend entry point. Integration must supply an authorized service user.
  post(value: unknown, origin: ReceiptOrigin, actor: string) {
    const input = parseReceipt(value);
    if (!origin || (origin.source !== 'MANUAL' && origin.source !== 'ONE_C'))
      invalid('Некорректный источник.');
    const sourceSystem = optionalText(origin.sourceSystem, 100),
      sourceOperationId = optionalText(origin.sourceOperationId, 255);
    if (!sourceSystem || !sourceOperationId)
      invalid('Укажите идентичность операции источника.');
    const identity = { source: origin.source, sourceSystem, sourceOperationId };
    const hash = receiptHash(input);
    return this.prisma.$transaction(
      async (tx) => {
        if (typeof actor !== 'string' || !actor) throw new ForbiddenException();
        const [user] = await tx.$queryRaw<
          { role: string | null; banned: boolean | null }[]
        >`SELECT role, banned FROM "user" WHERE id = ${actor} FOR SHARE`;
        if (
          !user ||
          user.banned ||
          !hasPermission(user.role, 'warehouse.receipts.manage')
        )
          throw new ForbiddenException();
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['warehouse:receipt', identity])}, 0))`;
        const previous = await tx.warehouseReceipt.findUnique({
          where: { source_sourceSystem_sourceOperationId: identity },
          include: receiptInclude,
        });
        if (previous) {
          if (previous.requestHash !== hash)
            throw new ConflictException({
              code: 'WAREHOUSE_RECEIPT_REQUEST_CONFLICT',
              message:
                'Идентификатор операции уже использован с другими данными.',
            });
          return receiptDto(previous);
        }
        const warehouseId = BigInt(input.warehouseId);
        await lockWarehouse(tx, warehouseId, true);
        const warehouse = await tx.warehouse.findUniqueOrThrow({
          where: { id: warehouseId },
        });
        const ordered = orderedLines(input);
        // Acquire every item/location/balance lock in numeric item then location order before writing.
        for (const itemId of [...new Set(ordered.map((line) => line.itemId))])
          await this.stock.lockBalances(
            tx,
            itemId,
            ordered
              .filter((line) => line.itemId === itemId)
              .map((line) => line.storageLocationId),
          );
        const items = await tx.warehouseItem.findMany({
          where: { id: { in: ordered.map((line) => BigInt(line.itemId)) } },
        });
        const locations = await tx.warehouseStorageLocation.findMany({
          where: {
            id: { in: ordered.map((line) => BigInt(line.storageLocationId)) },
          },
        });
        const itemMap = new Map(items.map((item) => [String(item.id), item]));
        const locationMap = new Map(
          locations.map((location) => [String(location.id), location]),
        );
        const receiptLines = input.lines.map((line) => {
          const item = itemMap.get(line.itemId);
          if (!item)
            throw new NotFoundException({
              code: 'WAREHOUSE_ITEM_NOT_FOUND',
              message: 'Номенклатура не найдена.',
            });
          const location = locationMap.get(line.storageLocationId);
          if (!location)
            throw new NotFoundException({
              code: 'WAREHOUSE_LOCATION_NOT_FOUND',
              message: 'Место хранения не найдено.',
            });
          if (!item.isActive || !location.isActive)
            throw new ConflictException({
              code: 'WAREHOUSE_RECEIPT_INACTIVE_REFERENCE',
              message: 'Номенклатура или место неактивны.',
            });
          if (location.warehouseId !== warehouseId)
            throw new ConflictException({
              code: 'WAREHOUSE_RECEIPT_LOCATION_MISMATCH',
              message: 'Место не принадлежит выбранному складу.',
            });
          return {
            rowNumber: line.rowNumber,
            itemId: item.id,
            storageLocationId: location.id,
            quantity: line.quantity,
            unitSnapshot: item.unit,
            itemArticleSnapshot: item.article,
            itemNameSnapshot: item.name,
            storageLocationNameSnapshot: location.name,
          };
        });
        const receipt = await tx.warehouseReceipt.create({
          data: {
            ...identity,
            warehouseId,
            requestHash: hash,
            createdByUserId: actor,
            documentNumber: input.documentNumber,
            documentDate: input.documentDate
              ? new Date(input.documentDate + 'T00:00:00Z')
              : null,
            comment: input.comment,
            warehouseNameSnapshot: warehouse.name,
            lines: { create: receiptLines },
          },
          include: receiptInclude,
        });
        for (const line of ordered)
          await this.stock.receiveStock(
            { tx, actorUserId: actor },
            line.itemId,
            line.storageLocationId,
            line.quantity,
          );
        const dto = receiptDto(receipt);
        await this.audit.writeFieldChanges({
          tx,
          userId: actor,
          module: AuditModule.WAREHOUSE,
          action: AuditAction.CREATE,
          entityType: 'warehouse_receipt',
          entityStringId: String(receipt.id),
          fields: [{ fieldName: 'Приход на склад', newValue: dto }],
        });
        return dto;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 15000,
      },
    );
  }
  async findOne(value: string) {
    const row = await this.prisma.warehouseReceipt.findUnique({
      where: { id: stockId(value, 'id') },
      include: receiptInclude,
    });
    if (!row)
      throw new NotFoundException({
        code: 'WAREHOUSE_RECEIPT_NOT_FOUND',
        message: 'Приход не найден.',
      });
    return receiptDto(row);
  }
}
