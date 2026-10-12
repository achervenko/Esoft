import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type EquipmentListQuery = {
  page?: string;
  limit?: string;
  sort?: string;
  direction?: string;
};

export function parseEquipmentListQuery(query: EquipmentListQuery) {
  const integer = (
    value: string | undefined,
    fallback: number,
    max: number,
  ) => {
    if (value === undefined) return fallback;
    const parsed = Number(value);
    if (
      !/^\d+$/.test(value) ||
      !Number.isSafeInteger(parsed) ||
      parsed < 1 ||
      parsed > max
    )
      throw new BadRequestException('Некорректные параметры страницы.');
    return parsed;
  };
  const page = integer(query.page, 1, 1000000);
  const limit = integer(query.limit, 100, 100);
  const direction = query.direction ?? 'asc';
  if (direction !== 'asc' && direction !== 'desc')
    throw new BadRequestException('Некорректное направление сортировки.');
  const columns: Record<string, Prisma.Sql> = {
    visibleId: Prisma.sql`e.visible_id`,
    name: Prisma.sql`lower(e.name) COLLATE app_registry_order`,
    inventoryNumber: Prisma.sql`lower(e.inventory_number) COLLATE app_registry_order`,
    serialNumber: Prisma.sql`lower(coalesce(e.serial_number, 'б/н')) COLLATE app_registry_order`,
    manufacturer: Prisma.sql`lower(manufacturer.name) COLLATE app_registry_order`,
    model: Prisma.sql`lower(model.name) COLLATE app_registry_order`,
    statusLabel: Prisma.sql`CASE e.status WHEN 'active' THEN 1 WHEN 'repair' THEN 2 WHEN 'maintenance' THEN 3 WHEN 'reserve' THEN 4 WHEN 'written_off' THEN 5 END`,
  };
  const sort = query.sort ?? 'visibleId';
  if (!Object.hasOwn(columns, sort))
    throw new BadRequestException('Некорректное поле сортировки.');
  return {
    page,
    limit,
    skip: (page - 1) * limit,
    // Equal primary values retain their ID order in both directions.
    order: Prisma.sql`${columns[sort]} ${direction === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`}, e.id ASC`,
  };
}
