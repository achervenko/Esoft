import { Prisma } from '@prisma/client';
import { stockError } from './stock.errors';
import { balanceSelect, type StockBalance } from './stock.types';
import { stockId } from './stock.validation';

export function assertStockTransaction(tx: Prisma.TransactionClient) {
  if (
    !tx ||
    typeof tx.$queryRaw !== 'function' ||
    typeof (tx as unknown as { $connect?: unknown }).$connect === 'function'
  )
    stockError(
      400,
      'WAREHOUSE_STOCK_TRANSACTION_REQUIRED',
      'Stock требует транзакцию вызывающего компонента.',
    );
}

// All writers, including reservations, must acquire these locks before balance locks.
// SHARE on the item coordinates with Catalog's FOR UPDATE (unit and status changes).
export async function lockStockBalances(
  tx: Prisma.TransactionClient,
  itemValue: string,
  locationValues: string[],
) {
  assertStockTransaction(tx);
  const itemId = stockId(itemValue, 'itemId');
  if (!Array.isArray(locationValues) || !locationValues.length)
    stockError(400, 'WAREHOUSE_STOCK_ID_INVALID', 'Укажите места хранения.');
  const locationIds = [
    ...new Set(locationValues.map((value) => stockId(value, 'locationId'))),
  ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const items = await tx.$queryRaw<{ id: bigint }[]>`
    SELECT id FROM warehouse_items WHERE id = ${itemId} FOR SHARE
  `;
  if (!items.length)
    stockError(404, 'WAREHOUSE_ITEM_NOT_FOUND', 'Номенклатура не найдена.', {
      itemId: itemValue,
    });
  for (const locationId of locationIds) {
    const locations = await tx.$queryRaw<{ id: bigint }[]>`
      SELECT id FROM warehouse_storage_locations WHERE id = ${locationId} FOR SHARE
    `;
    if (!locations.length)
      stockError(
        404,
        'WAREHOUSE_LOCATION_NOT_FOUND',
        'Место хранения не найдено.',
        { locationId: locationId.toString() },
      );
  }
  const balances = new Map<bigint, StockBalance>();
  for (const locationId of locationIds) {
    // A row lock alone cannot serialize creation of an absent balance.
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${`warehouse:stock:${itemId}:${locationId}`}, 0))
    `;
    await tx.$queryRaw`
      SELECT id FROM warehouse_balances
      WHERE item_id = ${itemId} AND storage_location_id = ${locationId}
      FOR UPDATE
    `;
    const balance = await tx.warehouseBalance.findUnique({
      where: {
        itemId_storageLocationId: { itemId, storageLocationId: locationId },
      },
      select: balanceSelect,
    });
    if (balance) balances.set(locationId, balance);
  }
  return { itemId, locationIds, balances };
}
