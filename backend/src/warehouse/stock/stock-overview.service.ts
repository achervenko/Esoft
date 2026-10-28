import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { parseStockOverview } from './stock-overview.validation';
import { stockId } from './stock.validation';
import { warehouseItemSummaryDto } from '../catalog/catalog.dto';
import {
  warehouseDto,
  locationWithWarehouseDto,
  locationWithWarehouseSelect,
} from '../storage-structure/storage-structure.dto';
type Group = {
  item_id: bigint;
  warehouse_id: bigint;
  quantity: Prisma.Decimal;
  locations_count: bigint;
};
@Injectable()
export class WarehouseStockOverviewService {
  constructor(private readonly prisma: PrismaService) {}
  list(value: unknown) {
    const q = parseStockOverview(value);
    const conditions = [Prisma.sql`TRUE`];
    if (q.warehouseId)
      conditions.push(Prisma.sql`l.warehouse_id = ${q.warehouseId}`);
    if (q.search) {
      const pattern =
        '%' + q.search.replace(/[\\%_]/g, (char) => '\\' + char) + '%';
      conditions.push(
        Prisma.sql`(i.article ILIKE ${pattern} OR i.name ILIKE ${pattern})`,
      );
    }
    // The location filter selects item/warehouse groups; totals cover the entire warehouse.
    if (q.locationId)
      conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM warehouse_balances matched JOIN warehouse_storage_locations ml ON ml.id=matched.storage_location_id
      WHERE matched.item_id=b.item_id AND ml.warehouse_id=l.warehouse_id AND ml.id=${q.locationId}
      ${q.quantityState === 'POSITIVE' ? Prisma.sql`AND matched.quantity > 0` : Prisma.empty})`);
    const having =
      q.quantityState === 'POSITIVE'
        ? Prisma.sql`HAVING SUM(b.quantity)>0`
        : q.quantityState === 'ZERO'
          ? Prisma.sql`HAVING SUM(b.quantity)=0`
          : Prisma.empty;
    const grouped = Prisma.sql`SELECT b.item_id,l.warehouse_id,SUM(b.quantity) AS quantity,
      COUNT(*) FILTER (WHERE b.quantity>0) AS locations_count
      FROM warehouse_balances b JOIN warehouse_storage_locations l ON l.id=b.storage_location_id
      JOIN warehouse_items i ON i.id=b.item_id WHERE ${Prisma.join(conditions, ' AND ')}
      GROUP BY b.item_id,l.warehouse_id ${having}`;
    const order = {
      article: Prisma.sql`i.article`,
      name: Prisma.sql`i.name`,
      quantity: Prisma.sql`g.quantity`,
      warehouse: Prisma.sql`w.name`,
    }[q.sortBy];
    const direction =
      q.sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    return this.prisma.$transaction(
      async (tx) => {
        const [count] = await tx.$queryRaw<
          { total: bigint }[]
        >`WITH grouped AS (${grouped}) SELECT COUNT(*) AS total FROM grouped`;
        const groups = await tx.$queryRaw<
          Group[]
        >`WITH grouped AS (${grouped}) SELECT g.* FROM grouped g
        JOIN warehouse_items i ON i.id=g.item_id JOIN warehouses w ON w.id=g.warehouse_id
        ORDER BY ${order} ${direction},g.item_id ASC,g.warehouse_id ASC LIMIT ${q.limit} OFFSET ${q.offset}`;
        const [catalog, warehouses] = await Promise.all([
          tx.warehouseItem.findMany({
            where: { id: { in: groups.map((g) => g.item_id) } },
          }),
          tx.warehouse.findMany({
            where: { id: { in: groups.map((g) => g.warehouse_id) } },
          }),
        ]);
        const itemMap = new Map(catalog.map((item) => [String(item.id), item]));
        const warehouseMap = new Map(warehouses.map((w) => [String(w.id), w]));
        const previewIds = groups.length
          ? await tx.$queryRaw<{ id: bigint }[]>(Prisma.sql`
          WITH selected(item_id,warehouse_id,positive) AS (VALUES ${Prisma.join(groups.map((g) => Prisma.sql`(${g.item_id}::bigint,${g.warehouse_id}::bigint,${g.locations_count > 0n}::boolean)`))})
          SELECT preview.id FROM selected s CROSS JOIN LATERAL (
            SELECT b.id FROM warehouse_balances b JOIN warehouse_storage_locations l ON l.id=b.storage_location_id
            WHERE b.item_id=s.item_id AND l.warehouse_id=s.warehouse_id AND (NOT s.positive OR b.quantity>0)
            ORDER BY l.name,b.id LIMIT 3
          ) preview`)
          : [];
        const previews = await tx.warehouseBalance.findMany({
          where: { id: { in: previewIds.map((b) => b.id) } },
          orderBy: [{ storageLocation: { name: 'asc' } }, { id: 'asc' }],
          include: { storageLocation: { select: locationWithWarehouseSelect } },
        });
        const items = groups.map((g) => {
          const item = itemMap.get(String(g.item_id))!;
          const warehouse = warehouseMap.get(String(g.warehouse_id))!;
          return {
            id: `${g.item_id}:${g.warehouse_id}`,
            item: { ...warehouseItemSummaryDto(item), photo: null },
            warehouse: warehouseDto(warehouse),
            quantity: g.quantity.toString(),
            locationsCount: Number(g.locations_count),
            locationsPreview: previews
              .filter(
                (b) =>
                  b.itemId === g.item_id &&
                  b.storageLocation.warehouseId === g.warehouse_id,
              )
              .map((b) => ({
                location: locationWithWarehouseDto(b.storageLocation),
                quantity: b.quantity.toString(),
              })),
          };
        });
        return {
          items,
          total: Number(count.total),
          page: q.page,
          limit: q.limit,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  distribution(itemValue: string, warehouseValue: string) {
    const itemId = stockId(itemValue, 'itemId'),
      warehouseId = stockId(warehouseValue, 'warehouseId');
    return this.prisma.$transaction(
      async (tx) => {
        const [item, warehouse, balances] = await Promise.all([
          tx.warehouseItem.findUnique({ where: { id: itemId } }),
          tx.warehouse.findUnique({ where: { id: warehouseId } }),
          tx.warehouseBalance.findMany({
            where: { itemId, storageLocation: { warehouseId } },
            orderBy: [{ storageLocation: { name: 'asc' } }, { id: 'asc' }],
            include: {
              storageLocation: { select: locationWithWarehouseSelect },
              reservations: { select: { quantity: true } },
            },
          }),
        ]);
        if (!item || !warehouse)
          throw new NotFoundException({
            code: 'WAREHOUSE_STOCK_NOT_FOUND',
            message: 'Товар или склад не найден.',
          });
        const total = balances.reduce(
          (sum, b) => sum.plus(b.quantity),
          new Prisma.Decimal(0),
        );
        return {
          item: { ...warehouseItemSummaryDto(item), photo: null },
          warehouse: warehouseDto(warehouse),
          totalQuantity: total.toString(),
          locations: balances.map((b) => {
            const reserved = b.reservations.reduce(
              (sum, r) => sum.plus(r.quantity),
              new Prisma.Decimal(0),
            );
            return {
              balanceId: String(b.id),
              location: locationWithWarehouseDto(b.storageLocation),
              quantity: b.quantity.toString(),
              reserved: reserved.toString(),
              available: Prisma.Decimal.max(
                b.quantity.minus(reserved),
                0,
              ).toString(),
            };
          }),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
