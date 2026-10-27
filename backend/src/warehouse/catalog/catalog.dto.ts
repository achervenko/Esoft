import { Prisma } from '@prisma/client';
export const warehouseItemIdentitySelect = {
  id: true,
  article: true,
  name: true,
  unit: true,
} satisfies Prisma.WarehouseItemSelect;
export const warehouseItemSummarySelect = {
  ...warehouseItemIdentitySelect,
  isActive: true,
} satisfies Prisma.WarehouseItemSelect;
export const warehouseItemSelect = {
  ...warehouseItemSummarySelect,
  comment: true,
} satisfies Prisma.WarehouseItemSelect;
export function warehouseItemIdentityDto(
  row: Prisma.WarehouseItemGetPayload<{
    select: typeof warehouseItemIdentitySelect;
  }>,
) {
  return {
    id: String(row.id),
    article: row.article,
    name: row.name,
    unit: row.unit,
  };
}
export function warehouseItemSummaryDto(
  row: Prisma.WarehouseItemGetPayload<{
    select: typeof warehouseItemSummarySelect;
  }>,
) {
  return { ...warehouseItemIdentityDto(row), isActive: row.isActive };
}
export function warehouseItemDto(
  row: Prisma.WarehouseItemGetPayload<{ select: typeof warehouseItemSelect }>,
) {
  return { ...warehouseItemSummaryDto(row), comment: row.comment };
}
