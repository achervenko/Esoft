import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { stockError } from '../stock/stock.errors';
import { WarehouseTransfersService } from '../transfers/transfers.service';
import { parseTransfer } from '../transfers/transfers.validation';
import { WarehouseReservationManager } from './reservation-manager.service';
import { assertReservationAccess } from './reservations-access';
import { WAREHOUSE_PERMISSIONS } from '../warehouse.permissions';
import { parseReservationUuid } from './reservations.validation';

@Injectable()
export class WarehouseReservationMoveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transfers: WarehouseTransfersService,
    private readonly manager: WarehouseReservationManager,
  ) {}

  async move(id: string, value: unknown, actor: string) {
    const reservationId = parseReservationUuid(id, 'reservationId');
    if (!value || typeof value !== 'object' || Array.isArray(value))
      stockError(400, 'WAREHOUSE_TRANSFER_INVALID', 'Ожидается объект.');
    const body = value as Record<string, unknown>;
    if (
      Object.keys(body).some(
        (key) =>
          ![
            'requestKey',
            'fromLocationId',
            'toLocationId',
            'quantity',
            'comment',
          ].includes(key),
      ) ||
      typeof body.quantity !== 'string'
    )
      stockError(
        400,
        'WAREHOUSE_TRANSFER_INVALID',
        'Некорректная команда перемещения.',
      );
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await assertReservationAccess(
            tx,
            actor,
            WAREHOUSE_PERMISSIONS.RESERVATIONS_MANAGE,
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
          const input = parseTransfer({
            ...body,
            itemId: String(reservation.itemId),
          });
          const transfer = await this.transfers.createInTransaction(
            tx,
            input,
            actor,
            {
              reservationId,
              manager: this.manager,
            },
          );
          const snapshot = transfer.snapshot as Prisma.JsonObject;
          return {
            reservation: snapshot.reservationResult,
            transfer: { ...transfer, reservationId },
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          timeout: 15000,
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      )
        stockError(
          409,
          'WAREHOUSE_RESERVATION_CONFLICT',
          'Конкурентное изменение. Повторите запрос.',
        );
      throw error;
    }
  }
}
