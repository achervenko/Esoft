import { randomUUID, createHash } from 'node:crypto';
import {
  Injectable,
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, AuditModule, AuditAction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { hasPermission } from '../../auth/permission-policy';
import { StorageStagedUploadService } from '../../storage/storage-staged-upload.service';
import type { UploadedFileInput } from '../../storage/storage.types';
import { WarehouseStockService } from '../stock/stock.service';
import { stockId } from '../stock/stock.validation';
import { lockWarehouse } from '../storage-structure/storage-structure.policy';
import { WarehouseReservationsService } from './reservations.service';
import { backedReservation } from './reservation-consumption';
import { parseReservationOperation } from './reservation-operations.validation';
const OWNER = {
  module: 'warehouse',
  entityType: 'reservation_operation',
} as const;
@Injectable()
export class WarehouseReservationOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: WarehouseStockService,
    private readonly reservations: WarehouseReservationsService,
    private readonly audit: AuditLogService,
    private readonly uploads: StorageStagedUploadService,
  ) {}
  private async admin(tx: Prisma.TransactionClient, actor: string) {
    const [user] = await tx.$queryRaw<
      { role: string | null; banned: boolean | null }[]
    >`SELECT role,banned FROM "user" WHERE id=${actor} FOR SHARE`;
    if (
      !user ||
      user.banned ||
      !hasPermission(user.role, 'warehouse.reservations.admin')
    )
      throw new ForbiddenException();
  }
  async upload(file: UploadedFileInput | undefined, actor: string) {
    await this.prisma.$transaction((tx) => this.admin(tx, actor));
    return this.uploads.prepare(OWNER, actor, 'supporting_document', file, {
      allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
      allowedMimeTypes: [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
      ],
      maxPixelCount: 120_000_000,
      validateContent: 'document',
    });
  }
  execute(value: string, body: unknown, actor: string) {
    const id = stockId(value, 'reservationId'),
      input = parseReservationOperation(body);
    const hash = createHash('sha256')
      .update(JSON.stringify({ reservationId: String(id), ...input }))
      .digest('hex');
    const fail = (code: string, message: string): never => {
      throw new ConflictException({ code, message });
    };
    return this.prisma.$transaction(
      async (tx) => {
        await this.admin(tx, actor);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['warehouse:reservation-operation', actor, input.requestKey])},0))`;
        const previous = await tx.warehouseReservationOperation.findUnique({
          where: {
            actorUserId_requestKey: {
              actorUserId: actor,
              requestKey: input.requestKey,
            },
          },
        });
        if (previous) {
          if (previous.requestHash !== hash)
            fail(
              'WAREHOUSE_RESERVATION_REQUEST_CONFLICT',
              'Ключ запроса уже использован.',
            );
          return previous.result;
        }
        if (input.attachments.length)
          await this.uploads.lockUploads(tx, input.attachments, OWNER, actor);
        const initial = await tx.warehouseProjectReservation.findUnique({
          where: { id },
          include: { balance: { include: { storageLocation: true } } },
        });
        if (!initial)
          throw new NotFoundException({
            code: 'WAREHOUSE_RESERVATION_NOT_FOUND',
            message: 'Резерв не найден.',
          });
        await tx.$queryRaw`SELECT id FROM warehouse_projects WHERE id=${initial.projectId} FOR SHARE`;
        if (input.action !== 'RELEASE')
          await lockWarehouse(
            tx,
            initial.balance.storageLocation.warehouseId,
            true,
          );
        await this.stock.lockBalances(tx, String(initial.balance.itemId), [
          String(initial.balance.storageLocationId),
        ]);
        const rows = await this.reservations.getLocked(tx, [initial.balanceId]);
        const own = rows.find((r) => r.id === id);
        if (!own)
          throw new NotFoundException({
            code: 'WAREHOUSE_RESERVATION_NOT_FOUND',
            message: 'Резерв не найден.',
          });
        const borrowed = own.borrowedQuantity ?? new Prisma.Decimal(0);
        if (
          !own.quantity.eq(input.expectedQuantity) ||
          !borrowed.eq(input.expectedBorrowedQuantity)
        )
          fail(
            'WAREHOUSE_RESERVATION_STALE',
            'Резерв изменился. Обновите данные.',
          );
        const balance = await tx.warehouseBalance.findUniqueOrThrow({
          where: { id: own.balanceId },
          include: { item: true, storageLocation: true },
        });
        const backed = backedReservation(own),
          allBacked = rows.reduce(
            (sum, r) => sum.plus(backedReservation(r)),
            new Prisma.Decimal(0),
          );
        let quantity = own.quantity,
          afterBorrowed = borrowed,
          physical = balance.quantity;
        if (input.action === 'RELEASE') {
          if (input.quantity.gt(quantity))
            fail(
              'WAREHOUSE_RESERVATION_INSUFFICIENT',
              'Нельзя снять больше резерва.',
            );
          quantity = quantity.minus(input.quantity);
          afterBorrowed = Prisma.Decimal.max(0, borrowed.minus(input.quantity));
        } else if (input.action === 'BORROW') {
          const maximum = Prisma.Decimal.max(
            0,
            Prisma.Decimal.min(backed, physical.minus(allBacked.minus(backed))),
          );
          if (input.quantity.gt(maximum))
            fail(
              'WAREHOUSE_RESERVATION_INSUFFICIENT',
              'Недостаточно обеспеченного товара этого проекта.',
            );
          if (!balance.item.isActive || !balance.storageLocation.isActive)
            fail(
              'WAREHOUSE_RESERVATION_UNAVAILABLE',
              'Номенклатура или место неактивны.',
            );
          await this.stock.issueStock(
            { tx, actorUserId: actor },
            String(balance.itemId),
            String(balance.storageLocationId),
            input.quantity,
          );
          physical = physical.minus(input.quantity);
          afterBorrowed = borrowed.plus(input.quantity);
        } else {
          const free = Prisma.Decimal.max(0, physical.minus(allBacked));
          if (input.quantity.gt(borrowed) || input.quantity.gt(free))
            fail(
              'WAREHOUSE_RESERVATION_INSUFFICIENT',
              'Недостаточно свободного товара или указанное количество превышает заимствованное.',
            );
          afterBorrowed = borrowed.minus(input.quantity);
        }
        if (quantity.isZero())
          await tx.warehouseProjectReservation.delete({ where: { id } });
        else
          await tx.warehouseProjectReservation.update({
            where: { id },
            data: { quantity, borrowedQuantity: afterBorrowed },
          });
        const operationId = randomUUID();
        const files = input.attachments.length
          ? await this.uploads.attach(
              tx,
              input.attachments,
              { ...OWNER, entityId: operationId },
              actor,
              true,
            )
          : [];
        const result = {
          id: operationId,
          reservationId: String(id),
          projectId: String(own.projectId),
          projectNumber: own.project.projectNumber,
          balanceId: String(own.balanceId),
          action: input.action,
          quantity: input.quantity.toString(),
          before: own.quantity.toString(),
          after: quantity.toString(),
          borrowedBefore: borrowed.toString(),
          borrowedAfter: afterBorrowed.toString(),
          physicalBefore: balance.quantity.toString(),
          physicalAfter: physical.toString(),
          comment: input.comment,
          attachments: files.map((f) => ({ id: f.id, name: f.originalName })),
        };
        await tx.warehouseReservationOperation.create({
          data: {
            id: operationId,
            actorUserId: actor,
            requestKey: input.requestKey,
            requestHash: hash,
            result,
          },
        });
        await this.audit.writeFieldChanges({
          tx,
          userId: actor,
          module: AuditModule.WAREHOUSE,
          entityType: 'warehouse_reservation_operation',
          entityStringId: operationId,
          action: AuditAction.CREATE,
          fields: [{ fieldName: 'Изменение резерва', newValue: result }],
        });
        return result;
      },
      { timeout: 15000 },
    );
  }
}
