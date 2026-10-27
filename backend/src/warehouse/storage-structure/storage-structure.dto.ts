import { Prisma } from '@prisma/client';
export const warehouseSelect = {
  id: true,
  code: true,
  name: true,
  isActive: true,
} satisfies Prisma.WarehouseSelect;
export type WarehouseSummary = Prisma.WarehouseGetPayload<{
  select: typeof warehouseSelect;
}>;
export function warehouseDto(row: WarehouseSummary) {
  return {
    id: String(row.id),
    code: row.code,
    name: row.name,
    isActive: row.isActive,
  };
}
export const locationWithWarehouseSelect = {
  id: true,
  code: true,
  name: true,
  isActive: true,
  warehouseId: true,
  warehouse: { select: warehouseSelect },
} satisfies Prisma.WarehouseStorageLocationSelect;
export type LocationWithWarehouse = Prisma.WarehouseStorageLocationGetPayload<{
  select: typeof locationWithWarehouseSelect;
}>;
export function locationWithWarehouseDto(row: LocationWithWarehouse) {
  return {
    id: String(row.id),
    code: row.code,
    name: row.name,
    isActive: row.isActive,
    warehouseId: String(row.warehouseId),
    warehouse: warehouseDto(row.warehouse),
  };
}
