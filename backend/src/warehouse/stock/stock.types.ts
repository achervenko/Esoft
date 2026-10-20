import type { Prisma } from '@prisma/client';

export type StockQuantity = string | Prisma.Decimal;

export type BalanceFilters = {
  itemId?: string;
  itemIds?: string[];
  locationId?: string;
  locationIds?: string[];
  quantityState?: 'POSITIVE' | 'ZERO' | 'ALL';
  minQuantity?: StockQuantity;
  maxQuantity?: StockQuantity;
  itemActive?: boolean;
  locationActive?: boolean;
  sortBy?: 'quantity' | 'item' | 'location';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
};

export type StockMutationContext = {
  tx: Prisma.TransactionClient;
  actorUserId: string;
};

export const balanceSelect = {
  id: true,
  itemId: true,
  storageLocationId: true,
  quantity: true,
  item: {
    select: { id: true, article: true, name: true, unit: true, isActive: true },
  },
  storageLocation: {
    select: { id: true, code: true, name: true, isActive: true },
  },
} satisfies Prisma.WarehouseBalanceSelect;

export type StockBalance = Prisma.WarehouseBalanceGetPayload<{
  select: typeof balanceSelect;
}>;

export function balanceDto(balance: StockBalance) {
  return {
    id: balance.id.toString(),
    itemId: balance.itemId.toString(),
    locationId: balance.storageLocationId.toString(),
    quantity: balance.quantity.toString(),
    item: { ...balance.item, id: balance.item.id.toString() },
    location: {
      ...balance.storageLocation,
      id: balance.storageLocation.id.toString(),
    },
  };
}
