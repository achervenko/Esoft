import { assertAdjustmentPortion } from './adjustment-portion';
import { changeReservationCoverage } from '../reservations/reservation-coverage';
import { ConflictException, Injectable } from '@nestjs/common';
import { AuditAction, AuditModule, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { StorageStagedUploadService } from '../../storage/storage-staged-upload.service';
import { WarehouseStockService } from '../stock/stock.service';
import { WarehouseStockAdjustmentAccessService } from './adjustment-access.service';
import { ADJUSTMENT_OWNER } from './adjustments.constants';
import { adjustmentInclude, toAdjustmentDto } from './adjustments.mapper';
import { adjustmentHash, parseAdjustment } from './adjustments.validation';

@Injectable()
export class WarehouseStockAdjustmentCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: WarehouseStockService,
    private readonly uploads: StorageStagedUploadService,
    private readonly audit: AuditLogService,
    private readonly access: WarehouseStockAdjustmentAccessService,
  ) {}

  async adjustStock(payload: unknown, actorUserId: string) {
    const input = parseAdjustment(payload);
    const hash = adjustmentHash(input);
    return this.prisma.$transaction(
      async (tx) => {
        await this.access.assertAdmin(tx, actorUserId);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['warehouse:adjustment', actorUserId, input.requestKey])}, 0))`;
        const noOp = await tx.warehouseStockAdjustmentNoop.findUnique({
          where: {
            actorUserId_requestKey: {
              actorUserId,
              requestKey: input.requestKey,
            },
          },
        });
        if (noOp) {
          if (noOp.requestHash !== hash)
            throw new ConflictException({
              code: 'WAREHOUSE_ADJUSTMENT_REQUEST_CONFLICT',
              message: 'Ключ запроса уже использован для другой корректировки.',
            });
          return {
            changed: false,
            quantity: noOp.quantity.toString(),
            adjustment: null,
          };
        }
        const previous = await tx.warehouseStockAdjustment.findUnique({
          where: {
            createdByUserId_requestKey: {
              createdByUserId: actorUserId,
              requestKey: input.requestKey,
            },
          },
          include: adjustmentInclude,
        });
        if (previous) {
          if (previous.requestHash !== hash)
            throw new ConflictException({
              code: 'WAREHOUSE_ADJUSTMENT_REQUEST_CONFLICT',
              message: 'Ключ запроса уже использован для другой корректировки.',
            });
          return { changed: true, adjustment: toAdjustmentDto(previous) };
        }
        const documents = input.attachments.length
          ? await this.uploads.lockUploads(
              tx,
              input.attachments,
              ADJUSTMENT_OWNER,
              actorUserId,
            )
          : [];
        await this.stock.lockBalances(tx, input.itemId, [input.locationId]);
        const current = await this.stock.getBalance(
          input.itemId,
          input.locationId,
          tx,
        );
        const before = new Prisma.Decimal(current?.quantity ?? '0');
        if (input.mode === 'ACTUAL' && !before.eq(input.expectedQuantity))
          throw new ConflictException({
            code: 'WAREHOUSE_ADJUSTMENT_STALE_BALANCE',
            message: 'Остаток изменился. Обновите данные перед корректировкой.',
            details: {
              expected: input.expectedQuantity,
              actual: before.toString(),
            },
          });
        await assertAdjustmentPortion(tx, input, before);
        const delta =
          input.mode === 'ACTUAL'
            ? new Prisma.Decimal(input.actualQuantity).minus(before)
            : new Prisma.Decimal(input.quantity);
        if (delta.isZero()) {
          await tx.warehouseStockAdjustmentNoop.create({
            data: {
              actorUserId,
              requestKey: input.requestKey,
              requestHash: hash,
              quantity: before,
            },
          });
          return {
            changed: false,
            quantity: before.toString(),
            adjustment: null,
          };
        }
        const type =
          input.mode === 'ACTUAL'
            ? delta.lt(0)
              ? 'WRITE_OFF'
              : 'SURPLUS'
            : input.type;
        const quantity = delta.abs();
        const context = { tx, actorUserId };
        const coverage = {
          reservationId: input.portion?.reservationId ?? '',
          locationId: input.locationId,
          quantity,
        };
        if (input.portion?.reservationId && type === 'WRITE_OFF')
          await changeReservationCoverage(
            this.audit,
            { ...context, comment: input.reason },
            coverage,
            'REDUCE_COVERAGE',
          );
        const balance =
          type === 'WRITE_OFF'
            ? await this.stock.issueStock(
                context,
                input.itemId,
                input.locationId,
                quantity,
              )
            : await this.stock.receiveStock(
                context,
                input.itemId,
                input.locationId,
                quantity,
              );
        if (input.portion?.reservationId && type === 'SURPLUS')
          await changeReservationCoverage(
            this.audit,
            { ...context, comment: input.reason },
            coverage,
            'RESTORE_COVERAGE',
          );
        const operation = await tx.warehouseStockAdjustment.create({
          data: {
            balanceId: BigInt(balance.id),
            type,
            quantity,
            quantityBefore: before,
            quantityAfter: balance.quantity,
            reason: input.reason,
            comment: input.comment,
            requestKey: input.requestKey,
            requestHash: hash,
            createdByUserId: actorUserId,
          },
        });
        const files = input.attachments.length
          ? await this.uploads.attach(
              tx,
              input.attachments,
              { ...ADJUSTMENT_OWNER, entityId: operation.id.toString() },
              actorUserId,
              true,
            )
          : [];
        await tx.warehouseStockAdjustmentAttachment.createMany({
          data: files.map((file) => ({
            adjustmentId: operation.id,
            fileId: file.id,
          })),
        });
        const snapshot = {
          ...(input.portion ? { portion: input.portion } : {}),
          type,
          itemId: input.itemId,
          article: balance.item.article,
          name: balance.item.name,
          unit: balance.item.unit,
          locationId: input.locationId,
          locationName: balance.location.name,
          quantity: quantity.toString(),
          quantityBefore: before.toString(),
          quantityAfter: balance.quantity,
          reason: input.reason,
          comment: input.comment,
          attachments: files.map((file) => ({
            id: file.id,
            originalName: file.originalName,
            sha256: documents.find((doc) => doc.objectKey === file.objectKey)!
              .sha256,
          })),
        };
        await this.audit.writeFieldChanges({
          tx,
          userId: actorUserId,
          module: AuditModule.WAREHOUSE,
          action: AuditAction.CREATE,
          entityType: 'warehouse_stock_adjustment',
          entityStringId: operation.id.toString(),
          fields: [
            {
              fieldName: 'Корректировка складского остатка',
              newValue: snapshot,
            },
          ],
        });
        return {
          changed: true,
          adjustment: toAdjustmentDto(
            await tx.warehouseStockAdjustment.findUniqueOrThrow({
              where: { id: operation.id },
              include: adjustmentInclude,
            }),
          ),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 15000,
      },
    );
  }
}
