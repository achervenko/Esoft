import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
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
  parseDemandIncrease,
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
    const { comment, requestKey, ...input } = parseReserve(value);
    return this.command(
      actor,
      RESERVATIONS_MANAGE,
      comment,
      async (context) => {
        if (input.locationId)
          await assertActivePlacement(
            context.tx,
            input.itemId,
            input.locationId,
          );
        return this.manager.reserve(context, input);
      },
      requestKey
        ? {
            key: requestKey,
            hash: createHash('sha256')
              .update(JSON.stringify({ ...input, comment }))
              .digest('hex'),
          }
        : undefined,
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

  increaseDemand(id: string, value: unknown, actor: string) {
    const reservationId = parseReservationUuid(id, 'reservationId');
    const { comment, ...input } = parseDemandIncrease(value);
    return this.command(
      actor,
      RESERVATIONS_MANAGE,
      comment,
      async (context) => {
        const { tx } = context;
        if (input.allocation) {
          await assertReservationAccess(
            tx,
            actor,
            RESERVATIONS_COVERAGE_MANAGE,
            true,
          );
          const reservation = await tx.warehouseReservation.findUnique({
            where: { id: reservationId },
            select: { itemId: true },
          });
          if (!reservation)
            stockError(
              404,
              'WAREHOUSE_RESERVATION_NOT_FOUND',
              'Резерв не найден.',
            );
          await assertActivePlacement(
            tx,
            String(reservation.itemId),
            input.allocation.locationId,
          );
        }
        return this.manager.increaseDemand(context, {
          reservationId,
          ...input,
        });
      },
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
    request?: { key: string; hash: string },
  ) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await assertReservationAccess(tx, actor, permission, true);
          const key = request && {
            actorUserId: actor,
            requestKey: request.key,
          };
          if (request && key) {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(['warehouse:reserve', actor, request.key])}, 0))`;
            const previous = await tx.warehouseReservationRequest.findUnique({
              where: { actorUserId_requestKey: key },
            });
            if (previous) {
              if (previous.requestHash !== request.hash)
                stockError(
                  409,
                  'WAREHOUSE_RESERVATION_REQUEST_CONFLICT',
                  'Ключ уже использован для другого резерва.',
                );
              return previous.response as unknown as Awaited<
                ReturnType<typeof readReservation>
              >;
            }
          }
          const { reservation } = await execute({
            tx,
            actorUserId: actor,
            comment,
          });
          const response = await readReservation(tx, reservation.id);
          if (request && key)
            await tx.warehouseReservationRequest.create({
              data: { ...key, requestHash: request.hash, response },
            });
          return response;
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
