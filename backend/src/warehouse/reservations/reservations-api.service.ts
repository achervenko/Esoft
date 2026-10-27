import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, AuditModule, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { hasPermission } from '../../auth/permission-policy';
import { WarehouseStockService } from '../stock/stock.service';
import { stockId } from '../stock/stock.validation';
import { WarehouseReservationsService } from './reservations.service';
import { reservationDto, reservationInclude } from './reservations.model';
import {
  parseReservation,
  parseReservationQuery,
} from './reservations.validation';
function missing(): never {
  throw new NotFoundException({
    code: 'WAREHOUSE_RESERVATION_NOT_FOUND',
    message: 'Резерв не найден.',
  });
}
@Injectable()
export class WarehouseReservationsApiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: WarehouseStockService,
    private readonly reservations: WarehouseReservationsService,
    private readonly audit: AuditLogService,
  ) {}
  async list(value: unknown) {
    const q = parseReservationQuery(value);
    const where: Prisma.WarehouseProjectReservationWhereInput = {
      balanceId: q.balanceId,
      projectId: q.projectId,
      balance: {
        itemId: q.itemId,
        storageLocationId: q.locationId,
        storageLocation: { warehouseId: q.warehouseId },
      },
    };
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.warehouseProjectReservation.findMany({
          where,
          include: reservationInclude,
          orderBy: { id: 'asc' },
          skip: (q.page - 1) * q.limit,
          take: q.limit,
        });
        return {
          items: rows.map(reservationDto),
          total: await tx.warehouseProjectReservation.count({ where }),
          page: q.page,
          limit: q.limit,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  create(body: unknown, actor: string) {
    const input = parseReservation(body, true);
    return this.mutate(actor, {
      balanceId: input.balanceId!,
      projectId: input.projectId!,
      quantity: input.quantity,
    });
  }
  update(value: string, body: unknown, actor: string) {
    const id = stockId(value, 'id');
    const { quantity } = parseReservation(body);
    return this.mutate(actor, { id, quantity });
  }
  release(value: string, actor: string) {
    return this.mutate(actor, { id: stockId(value, 'id'), release: true });
  }
  private async mutate(
    actor: string,
    input: {
      id?: bigint;
      balanceId?: bigint;
      projectId?: bigint;
      quantity?: Prisma.Decimal;
      release?: boolean;
    },
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        if (typeof actor !== 'string' || !actor) throw new ForbiddenException();
        const [user] = await tx.$queryRaw<
          { role: string | null; banned: boolean | null }[]
        >`SELECT role,banned FROM "user" WHERE id=${actor} FOR SHARE`;
        if (
          !user ||
          user.banned ||
          !hasPermission(user.role, 'warehouse.reservations.manage')
        )
          throw new ForbiddenException();
        // Resolve immutable keys without taking reservation locks before Stock locks.
        const initial =
          input.id === undefined
            ? null
            : await tx.warehouseProjectReservation.findUnique({
                where: { id: input.id },
              });
        if (input.id !== undefined && !initial) missing();
        const balanceId = initial?.balanceId ?? input.balanceId!;
        const projectId = initial?.projectId ?? input.projectId!;
        // Project precedes Stock, matching Issues lock order.
        const [project] = await tx.$queryRaw<
          { is_active: boolean }[]
        >`SELECT is_active FROM warehouse_projects WHERE id=${projectId} FOR SHARE`;
        const initialBalance = await tx.warehouseBalance.findUnique({
          where: { id: balanceId },
          select: { itemId: true, storageLocationId: true },
        });
        if (!initialBalance)
          throw new NotFoundException({
            code: 'WAREHOUSE_BALANCE_NOT_FOUND',
            message: 'Остаток не найден.',
          });
        await this.stock.lockBalances(tx, String(initialBalance.itemId), [
          String(initialBalance.storageLocationId),
        ]);
        const locked = await this.reservations.getLocked(tx, [balanceId]);
        const previous =
          input.id === undefined ? null : locked.find((r) => r.id === input.id);
        if (input.id !== undefined && !previous) missing();
        if (
          input.id === undefined &&
          locked.some((r) => r.projectId === projectId)
        )
          throw new ConflictException({
            code: 'WAREHOUSE_RESERVATION_EXISTS',
            message: 'Резерв остатка для проекта уже существует.',
          });
        const balance = await tx.warehouseBalance.findUnique({
          where: { id: balanceId },
          include: { item: true, storageLocation: true },
        });
        if (!balance)
          throw new NotFoundException({
            code: 'WAREHOUSE_BALANCE_NOT_FOUND',
            message: 'Остаток не найден.',
          });
        const increasing =
          !input.release &&
          (!previous || input.quantity!.gt(previous.quantity));
        if (increasing) {
          if (
            !project?.is_active ||
            !balance.item.isActive ||
            !balance.storageLocation.isActive
          )
            throw new ConflictException({
              code: 'WAREHOUSE_RESERVATION_UNAVAILABLE',
              message: 'Проект, номенклатура или место хранения недоступны.',
            });
          const others = locked
            .filter((r) => r.id !== previous?.id)
            .reduce((sum, r) => sum.plus(r.quantity), new Prisma.Decimal(0));
          const maximum = Prisma.Decimal.max(balance.quantity.minus(others), 0);
          if (input.quantity!.gt(maximum))
            throw new ConflictException({
              code: 'WAREHOUSE_RESERVATION_INSUFFICIENT',
              message: 'Недостаточно свободного остатка.',
              details: {
                balanceId: String(balanceId),
                physical: balance.quantity.toString(),
                maximum: maximum.toString(),
                requested: input.quantity!.toString(),
              },
            });
        }
        if (input.release) {
          await tx.warehouseProjectReservation.delete({
            where: { id: input.id },
          });
          await this.writeAudit(
            tx,
            actor,
            previous!.id,
            AuditAction.DELETE,
            {
              balanceId: String(balanceId),
              projectId: String(projectId),
              quantity: previous!.quantity.toString(),
            },
            null,
          );
          return { released: true, id: String(input.id) };
        }
        const row = previous
          ? await tx.warehouseProjectReservation.update({
              where: { id: previous.id },
              data: { quantity: input.quantity },
              include: reservationInclude,
            })
          : await tx.warehouseProjectReservation.create({
              data: { balanceId, projectId, quantity: input.quantity! },
              include: reservationInclude,
            });
        if (!previous || !previous.quantity.eq(row.quantity))
          await this.writeAudit(
            tx,
            actor,
            row.id,
            previous ? AuditAction.UPDATE : AuditAction.CREATE,
            previous
              ? {
                  balanceId: String(balanceId),
                  projectId: String(projectId),
                  quantity: previous.quantity.toString(),
                }
              : null,
            {
              balanceId: String(balanceId),
              projectId: String(projectId),
              quantity: row.quantity.toString(),
            },
          );
        return reservationDto(row);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }
  private writeAudit(
    tx: Prisma.TransactionClient,
    actor: string,
    id: bigint,
    action: AuditAction,
    before: unknown,
    after: unknown,
  ) {
    return this.audit.writeFieldChanges({
      tx,
      userId: actor,
      module: AuditModule.WAREHOUSE,
      entityType: 'warehouse_project_reservation',
      entityStringId: String(id),
      action,
      fields: [
        { fieldName: 'Резерв проекта', oldValue: before, newValue: after },
      ],
    });
  }
}
