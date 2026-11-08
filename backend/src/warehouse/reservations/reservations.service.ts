import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Permission } from '../../auth/permission-policy';
import { PrismaService } from '../../prisma/prisma.service';
import { stockError } from '../stock/stock.errors';
import { lockStockBalances } from '../stock/stock-locks';
import { WAREHOUSE_PERMISSIONS } from '../warehouse.permissions';
import { WarehouseReservationManager } from './reservation-manager.service';
import { assertReservationAccess } from './reservations-access';
import { readReservation } from './reservations.dto';
import {
  parseCoverage,
  parseDecrease,
  parseReservationUuid,
  parseReserve,
} from './reservations.validation';
import type { ReservationContext } from './reservation-common';

const { RESERVATIONS_MANAGE, RESERVATIONS_COVERAGE_MANAGE } =
  WAREHOUSE_PERMISSIONS;

@Injectable()
export class WarehouseReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly manager: WarehouseReservationManager,
  ) {}

  reserve(value: unknown, actor: string) {
    const { comment, ...input } = parseReserve(value);
    return this.command(
      actor,
      RESERVATIONS_MANAGE,
      comment,
      async (context) => {
        await assertActivePlacement(context.tx, input.itemId, input.locationId);
        return this.manager.reserve(context, input);
      },
    );
  }

  decrease(id: string, value: unknown, actor: string) {
    const reservationId = parseReservationUuid(id, 'reservationId');
    const { comment, ...input } = parseDecrease(value);
    return this.command(actor, RESERVATIONS_MANAGE, comment, (context) =>
      this.manager.decrease(context, { reservationId, ...input }),
    );
  }

  reduceCoverage(id: string, value: unknown, actor: string) {
    const reservationId = parseReservationUuid(id, 'reservationId');
    const { comment, ...input } = parseCoverage(value);
    return this.command(
      actor,
      RESERVATIONS_COVERAGE_MANAGE,
      comment,
      (context) =>
        this.manager.reduceCoverage(context, { reservationId, ...input }),
    );
  }

  restoreCoverage(id: string, value: unknown, actor: string) {
    const reservationId = parseReservationUuid(id, 'reservationId');
    const { comment, ...input } = parseCoverage(value);
    return this.command(
      actor,
      RESERVATIONS_COVERAGE_MANAGE,
      comment,
      async (context) => {
        const identity = await context.tx.warehouseReservation.findUnique({
          where: { id: reservationId },
          select: { itemId: true },
        });
        if (!identity)
          stockError(
            404,
            'WAREHOUSE_RESERVATION_NOT_FOUND',
            'Резерв не найден.',
          );
        await assertActivePlacement(
          context.tx,
          String(identity.itemId),
          input.locationId,
        );
        return this.manager.restoreCoverage(context, {
          reservationId,
          ...input,
        });
      },
    );
  }

  private async command(
    actor: string,
    permission: Permission,
    comment: string | undefined,
    execute: (
      context: ReservationContext,
    ) => Promise<{ reservation: { id: string } }>,
  ) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await assertReservationAccess(tx, actor, permission, true);
          const { reservation } = await execute({
            tx,
            actorUserId: actor,
            comment,
          });
          return readReservation(tx, reservation.id);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      )
        stockError(
          409,
          'WAREHOUSE_RESERVATION_CONFLICT',
          'Резерв изменяется другой операцией. Повторите запрос.',
        );
      throw error;
    }
  }
}

async function assertActivePlacement(
  tx: Prisma.TransactionClient,
  item: string,
  location: string,
) {
  const {
    itemId,
    locationIds: [locationId],
    balances,
  } = await lockStockBalances(tx, item, [location]);
  const balance = balances.get(locationId);
  const itemRow =
    balance?.item ??
    (await tx.warehouseItem.findUniqueOrThrow({
      where: { id: itemId },
      select: { isActive: true },
    }));
  const locationRow =
    balance?.storageLocation ??
    (await tx.warehouseStorageLocation.findUniqueOrThrow({
      where: { id: locationId },
      select: { isActive: true },
    }));
  if (!itemRow.isActive || !locationRow.isActive)
    stockError(
      409,
      'WAREHOUSE_RESERVATION_INACTIVE_REFERENCE',
      'Номенклатура или место хранения неактивны.',
    );
}
