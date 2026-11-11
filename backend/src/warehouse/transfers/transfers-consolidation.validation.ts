import { BadRequestException } from '@nestjs/common';
import { stockId } from '../stock/stock.validation';
import { parseTransfer } from './transfers.validation';

export function parseConsolidation(value: unknown) {
  const invalid = (): never => {
    throw new BadRequestException({
      code: 'WAREHOUSE_TRANSFER_INVALID',
      message: 'Некорректный набор перемещений.',
    });
  };
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const b = value as Record<string, unknown>;
  if (
    Object.keys(b).some(
      (k) =>
        ![
          'requestKey',
          'itemId',
          'fromWarehouseId',
          'toLocationId',
          'moves',
        ].includes(k),
    ) ||
    !Array.isArray(b.moves) ||
    !b.moves.length ||
    b.moves.length > 500
  )
    invalid();
  const moves = (b.moves as unknown[])
    .map((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        invalid();
      const row = value as Record<string, unknown>;
      if (
        Object.keys(row).some(
          (k) => !['fromLocationId', 'quantity', 'distribution'].includes(k),
        )
      )
        invalid();
      return parseTransfer({
        requestKey: b.requestKey,
        itemId: b.itemId,
        toLocationId: b.toLocationId,
        fromLocationId: row.fromLocationId,
        quantity: row.quantity,
        distribution: row.distribution,
      });
    })
    .sort((a, b) => a.fromLocationId.localeCompare(b.fromLocationId));
  if (new Set(moves.map((m) => m.fromLocationId)).size !== moves.length)
    invalid();
  return {
    requestKey: moves[0].requestKey,
    itemId: moves[0].itemId,
    toLocationId: moves[0].toLocationId,
    fromWarehouseId: String(stockId(b.fromWarehouseId, 'fromWarehouseId')),
    moves,
  };
}
