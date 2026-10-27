import {
  warehouseItemDto,
  warehouseItemIdentityDto,
  warehouseItemSummaryDto,
} from './catalog/catalog.dto';
import {
  warehouseDto,
  locationWithWarehouseDto,
} from './storage-structure/storage-structure.dto';
import { balanceDto } from './stock/stock.types';
import { Prisma } from '@prisma/client';

describe('Warehouse shared API contracts', () => {
  const warehouse = {
    id: 9007199254740993n,
    code: 'MAIN',
    name: 'Склад',
    isActive: true,
  };
  const location = {
    id: 9007199254740995n,
    warehouseId: warehouse.id,
    warehouse,
    code: 'A-01',
    name: 'Место',
    isActive: true,
  };
  const item = {
    id: 9007199254740997n,
    article: 'PART',
    name: 'Деталь',
    unit: 'шт',
    isActive: true,
    comment: 'Каталог',
  };
  it('uses identical warehouse/location representations in the directory and stock without bigint JSON failures', () => {
    const dto = balanceDto({
      id: 9007199254740999n,
      itemId: item.id,
      storageLocationId: location.id,
      quantity: new Prisma.Decimal('1.125'),
      item,
      storageLocation: location,
    });
    expect(dto.location).toEqual(locationWithWarehouseDto(location));
    expect(dto.location.warehouse).toEqual(warehouseDto(warehouse));
    expect(dto.location.warehouseId).toBe('9007199254740993');
    expect(dto.item).toEqual(warehouseItemSummaryDto(item));
    expect(dto.quantity).toBe('1.125');
    expect(() => JSON.stringify(dto)).not.toThrow();
  });
  it('keeps catalog-only fields out of summary/identity contracts', () => {
    expect(warehouseItemDto(item).comment).toBe('Каталог');
    expect(warehouseItemSummaryDto(item)).not.toHaveProperty('comment');
    expect(warehouseItemIdentityDto(item)).not.toHaveProperty('isActive');
    expect(warehouseItemIdentityDto(item).id).toBe('9007199254740997');
  });
});
