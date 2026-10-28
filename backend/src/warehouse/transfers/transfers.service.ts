import {
  planReservationTransfer,
  applyReservationTransfer,
  auditReservationTransfer,
} from './transfers-reservations';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  AuditModule,
  Prisma,
  type WarehouseTransfer,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { hasPermission } from '../../auth/permission-policy';
import { WarehouseStockService } from '../stock/stock.service';
import { WarehouseReservationsService } from '../reservations/reservations.service';
import { stockId } from '../stock/stock.validation';
import { lockWarehouse } from '../storage-structure/storage-structure.policy';
import {
  locationWithWarehouseSelect,
  locationWithWarehouseDto,
} from '../storage-structure/storage-structure.dto';
import { warehouseItemIdentityDto } from '../catalog/catalog.dto';
import {
  parseTransfer,
  parseTransferQuery,
  transferHash,
} from './transfers.validation';
function dto(row: WarehouseTransfer) {
  return {
    id: String(row.id),
    itemId: String(row.itemId),
    fromLocationId: String(row.fromLocationId),
    toLocationId: String(row.toLocationId),
    quantity: row.quantity.toString(),
    comment: row.comment,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    requestKey: row.requestKey,
    moveReservation: !!(
      row.snapshot &&
      typeof row.snapshot === 'object' &&
      !Array.isArray(row.snapshot) &&
      row.snapshot.reservationTransfer
    ),
    snapshot: row.snapshot,
  };
}
@Injectable()
export class WarehouseTransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: WarehouseStockService,
    private readonly reservations: WarehouseReservationsService,
    private readonly audit: AuditLogService,
  ) {}
  create(value: unknown, actor: string) {
    const input = parseTransfer(value),
      hash = transferHash(input);
    return this.prisma.$transaction(
      async (tx) => {
        if (typeof actor !== 'string' || !actor) throw new ForbiddenException();
        const [user] = await tx.$queryRaw<
          { role: string | null; banned: boolean | null }[]
        >`SELECT role,banned FROM "user" WHERE id = ${actor} FOR SHARE`;
        if (
          !user ||
          user.banned ||
          !hasPermission(user.role, 'warehouse.transfers.manage') ||
          (input.moveReservation &&
            !hasPermission(user.role, 'warehouse.reservations.manage'))
        )
          throw new ForbiddenException({
            code: 'FORBIDDEN',
            message: 'Недостаточно прав для перемещения.',
          });
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['warehouse:transfer', actor, input.requestKey])},0))`;
        const previous = await tx.warehouseTransfer.findUnique({
          where: {
            createdByUserId_requestKey: {
              createdByUserId: actor,
              requestKey: input.requestKey,
            },
          },
        });
        if (previous) {
          if (previous.requestHash !== hash)
            throw new ConflictException({
              code: 'WAREHOUSE_TRANSFER_REQUEST_CONFLICT',
              message: 'Ключ уже использован с другими данными.',
            });
          return dto(previous);
        }
        if (input.projectId !== null) {
          const [project] = await tx.$queryRaw<
            { is_active: boolean }[]
          >`SELECT is_active FROM warehouse_projects WHERE id=${BigInt(input.projectId)} FOR SHARE`;
          if (!project?.is_active)
            throw new ConflictException({
              code: 'WAREHOUSE_TRANSFER_PROJECT_UNAVAILABLE',
              message: 'Проект не найден или неактивен.',
            });
        }
        const locationIds = [
          BigInt(input.fromLocationId),
          BigInt(input.toLocationId),
        ];
        const references = await tx.warehouseStorageLocation.findMany({
          where: { id: { in: locationIds } },
          select: { warehouseId: true },
        });
        for (const id of [
          ...new Set(references.map((r) => r.warehouseId)),
        ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)))
          await lockWarehouse(tx, id, true);
        await this.stock.lockBalances(tx, input.itemId, [
          input.fromLocationId,
          input.toLocationId,
        ]);
        const locations = await tx.warehouseStorageLocation.findMany({
          where: { id: { in: locationIds } },
          select: locationWithWarehouseSelect,
        });
        const item = await tx.warehouseItem.findUniqueOrThrow({
          where: { id: BigInt(input.itemId) },
        });
        if (!item.isActive || locations.some((l) => !l.isActive))
          throw new ConflictException({
            code: 'WAREHOUSE_TRANSFER_INACTIVE_REFERENCE',
            message: 'Номенклатура или место неактивны.',
          });
        const from = locations.find(
          (l) => String(l.id) === input.fromLocationId,
        );
        const to = locations.find((l) => String(l.id) === input.toLocationId);
        if (!from || !to)
          throw new NotFoundException({
            code: 'WAREHOUSE_LOCATION_NOT_FOUND',
            message: 'Место хранения не найдено.',
          });
        const balance = await this.stock.getBalance(
          input.itemId,
          input.fromLocationId,
          tx,
        );
        if (!balance)
          throw new NotFoundException({
            code: 'WAREHOUSE_BALANCE_NOT_FOUND',
            message: 'Исходный остаток не найден.',
          });
        const destination = await this.stock.getBalance(
          input.itemId,
          input.toLocationId,
          tx,
        );
        const reservations = await this.reservations.getLocked(tx, [
          BigInt(balance.id),
          ...(destination ? [BigInt(destination.id)] : []),
        ]);
        const reservationPlan = planReservationTransfer(
          reservations,
          BigInt(balance.id),
          destination ? BigInt(destination.id) : undefined,
          balance.quantity,
          input.quantity,
          input.projectId,
        );
        const moved = await this.stock.moveStock(
          { tx, actorUserId: actor },
          input.itemId,
          input.fromLocationId,
          input.toLocationId,
          input.quantity,
        );
        const reservationTransfer = reservationPlan
          ? await applyReservationTransfer(
              tx,
              reservationPlan,
              BigInt(moved.to.id),
            )
          : null;
        const snapshot = {
          reservationTransfer,
          item: warehouseItemIdentityDto(item),
          from: locationWithWarehouseDto(from),
          to: locationWithWarehouseDto(to),
          fromQuantityBefore: balance.quantity,
          fromQuantityAfter: moved.from.quantity,
          toQuantityBefore: new Prisma.Decimal(moved.to.quantity)
            .minus(input.quantity)
            .toString(),
          toQuantityAfter: moved.to.quantity,
        };
        const operation = await tx.warehouseTransfer.create({
          data: {
            itemId: item.id,
            fromLocationId: from.id,
            toLocationId: to.id,
            quantity: input.quantity,
            comment: input.comment,
            createdByUserId: actor,
            requestKey: input.requestKey,
            requestHash: hash,
            snapshot,
          },
        });
        if (reservationTransfer)
          await auditReservationTransfer(
            tx,
            this.audit,
            actor,
            operation.id,
            reservationTransfer,
          );
        const result = dto(operation);
        await this.audit.writeFieldChanges({
          tx,
          userId: actor,
          module: AuditModule.WAREHOUSE,
          action: AuditAction.CREATE,
          entityType: 'warehouse_transfer',
          entityStringId: String(operation.id),
          fields: [{ fieldName: 'Перемещение', newValue: result }],
        });
        return result;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 15000,
      },
    );
  }
  async findOne(value: string) {
    const row = await this.prisma.warehouseTransfer.findUnique({
      where: { id: stockId(value, 'id') },
    });
    if (!row)
      throw new NotFoundException({
        code: 'WAREHOUSE_TRANSFER_NOT_FOUND',
        message: 'Перемещение не найдено.',
      });
    return dto(row);
  }
  list(value: unknown) {
    const q = parseTransferQuery(value);
    const where: Prisma.WarehouseTransferWhereInput = {
      itemId: q.itemId,
      fromLocationId: q.fromLocationId,
      toLocationId: q.toLocationId,
      ...(q.warehouseId === undefined
        ? {}
        : {
            OR: [
              { fromLocation: { warehouseId: q.warehouseId } },
              { toLocation: { warehouseId: q.warehouseId } },
            ],
          }),
    };
    return this.prisma.$transaction(
      async (tx) => ({
        items: (
          await tx.warehouseTransfer.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip: (q.page - 1) * q.limit,
            take: q.limit,
          })
        ).map(dto),
        total: await tx.warehouseTransfer.count({ where }),
        page: q.page,
        limit: q.limit,
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
