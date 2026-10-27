import {
  warehouseItemSummarySelect,
  warehouseItemSummaryDto,
} from '../catalog/catalog.dto';
import {
  locationWithWarehouseSelect,
  locationWithWarehouseDto,
} from '../storage-structure/storage-structure.dto';
import type { Prisma } from '@prisma/client';

export type StockQuantity = string | Prisma.Decimal;

export type BalanceFilters = {
  warehouseId?: string;
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
    select: warehouseItemSummarySelect,
  },
  storageLocation: { select: locationWithWarehouseSelect },
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
    item: warehouseItemSummaryDto(balance.item),
    location: locationWithWarehouseDto(balance.storageLocation),
  };
}
