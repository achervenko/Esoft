import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WarehouseStockService } from '../stock/stock.service';
import { WarehouseReservationManager } from '../reservations/reservation-manager.service';
import {
  assertReadCommitted,
  lockReservation,
} from '../reservations/reservation-common';
import {
  reservationOrderDto,
  reservationOrderSelect,
} from '../reservations/reservations.dto';
import { receiptActor, receiptConflict } from './receipts.policy';
import { invalid } from './receipts.validation';
import { stockId, stockQuantity } from '../stock/stock.validation';
import { parseReservationUuid } from '../reservations/reservations.validation';

type PlacementContext = {
  tx: Prisma.TransactionClient;
  actorUserId: string;
};
export type OrderPlacementInput = {
  receiptId: string;
  receiptLineId: string;
  orderId: string | null;
  itemId: string;
  locationId: string;
  quantity: string;
  reservationAllocation?: { restoreQuantity: string; increaseQuantity: string };
};

@Injectable()
export class WarehouseReceiptOrderPlacementService {
  constructor(
    private readonly stock: WarehouseStockService,
    private readonly reservations: WarehouseReservationManager,
  ) {}

  async apply(context: PlacementContext, input: OrderPlacementInput) {
    const { tx, actorUserId } = context;
    await assertReadCommitted(tx);
    await receiptActor(tx, actorUserId, 'warehouse.receipts.place');
    const quantity = stockQuantity(input.quantity);
    stockId(input.itemId, 'itemId');
    stockId(input.locationId, 'locationId');
    if (input.orderId === null) {
      if (input.reservationAllocation)
        invalid('Распределение резерва требует заказа в строке прихода.');
      await this.stock.receiveStock(
        context,
        input.itemId,
        input.locationId,
        quantity,
      );
      return null;
    }
    const orderId = parseReservationUuid(input.orderId, 'orderId');
    const order = await tx.customerOrder.findUnique({
      where: { id: orderId },
      select: reservationOrderSelect,
    });
    if (!order)
      throw new NotFoundException({
        code: 'WAREHOUSE_RESERVATION_ORDER_NOT_FOUND',
        message: 'Заказ не найден.',
      });
    await this.stock.lockBalances(tx, input.itemId, [input.locationId]);
    await lockReservation(tx, orderId, BigInt(input.itemId));
    const current = await tx.warehouseReservation.findUnique({
      where: { orderId_itemId: { orderId, itemId: BigInt(input.itemId) } },
      include: { allocations: true },
    });
    const deficit =
      current?.allocations.reduce(
        (remaining, allocation) => remaining.minus(allocation.quantity),
        current.quantity,
      ) ?? new Prisma.Decimal(0);
    if (deficit.gt(0) && !input.reservationAllocation)
      receiptConflict(
        'WAREHOUSE_RECEIPT_RESERVATION_ALLOCATION_REQUIRED',
        'Выберите распределение поступления при существующем дефиците.',
        {
          orderId,
          itemId: input.itemId,
          deficitQuantity: deficit.toString(),
          receivedQuantity: quantity.toString(),
        },
      );
    const restored = stockQuantity(
      input.reservationAllocation?.restoreQuantity ?? '0',
      true,
    );
    const increased = stockQuantity(
      input.reservationAllocation?.increaseQuantity ?? quantity,
      true,
    );
    if (!restored.plus(increased).eq(quantity))
      invalid(
        'Сумма восстановления и увеличения должна равняться размещаемому количеству.',
      );
    if (restored.gt(deficit))
      receiptConflict(
        'WAREHOUSE_RESERVATION_DEFICIT_INSUFFICIENT',
        'Количество восстановления превышает текущий дефицит.',
      );
    await this.stock.receiveStock(
      context,
      input.itemId,
      input.locationId,
      quantity,
    );
    const reservationContext = {
      ...context,
      receipt: {
        receiptId: input.receiptId,
        receiptLineId: input.receiptLineId,
        restoredQuantity: restored.toString(),
        increasedQuantity: increased.toString(),
      },
    };
    if (restored.gt(0))
      await this.reservations.restoreCoverage(reservationContext, {
        reservationId: current!.id,
        locationId: input.locationId,
        quantity: restored,
      });
    const result = increased.gt(0)
      ? await this.reservations.reserve(reservationContext, {
          orderId,
          itemId: input.itemId,
          locationId: input.locationId,
          quantity: increased,
        })
      : null;
    const orderSnapshot = reservationOrderDto(order);
    return {
      order: orderSnapshot,
      orderId,
      reservationId: result?.reservation.id ?? current!.id,
      receivedQuantity: quantity.toString(),
      restoredQuantity: restored.toString(),
      increasedQuantity: increased.toString(),
      deficitQuantity: deficit.minus(restored).toString(),
      warnings: orderSnapshot.warnings,
    };
  }
}
