import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { assertStockTransaction } from './stock-locks';
import type { BalanceFilters } from './stock.types';
import {
  parseBalanceFilters,
  stockId,
  stockQuantity,
} from './stock.validation';

function errorCode(action: () => unknown) {
  try {
    action();
  } catch (error) {
    if (error instanceof HttpException)
      return (error.getResponse() as { code: string }).code;
    throw error;
  }
  throw new Error('Expected a validation error');
}

describe('Stock input contract', () => {
  it('keeps bigint IDs exact', () => {
    expect(stockId('9007199254740993', 'itemId')).toBe(9007199254740993n);
    expect(stockId('9223372036854775807', 'itemId')).toBe(9223372036854775807n);
  });
  it.each([
    0,
    1,
    1n,
    null,
    '',
    '0',
    '-1',
    '01',
    '1e3',
    '1.0',
    ' 1',
    '9223372036854775808',
  ])('rejects invalid ID %p', (value) => {
    expect(errorCode(() => stockId(value, 'itemId'))).toBe(
      'WAREHOUSE_STOCK_ID_INVALID',
    );
  });
  it('accepts exact decimal quantities and zero only in filters', () => {
    for (const value of [
      '0.001',
      '123.45',
      '99999999999.999',
      new Prisma.Decimal('42.125'),
    ])
      expect(stockQuantity(value).toString()).toBe(
        new Prisma.Decimal(value).toString(),
      );
    expect(stockQuantity('0', true).toString()).toBe('0');
  });
  it.each([
    0,
    1,
    0.1 + 0.2,
    NaN,
    Infinity,
    null,
    true,
    '',
    '0',
    '-1',
    '0.0001',
    '1.2345',
    '1e3',
    ' 1 ',
    '100000000000',
    new Prisma.Decimal('NaN'),
    new Prisma.Decimal('Infinity'),
    new Prisma.Decimal('-1'),
    new Prisma.Decimal('0.0001'),
    new Prisma.Decimal('100000000000'),
  ])('rejects invalid operation quantity %p', (value) => {
    expect(errorCode(() => stockQuantity(value))).toBe(
      'WAREHOUSE_STOCK_QUANTITY_INVALID',
    );
  });
  it('defaults to positive balances without implicit activity filtering', () => {
    expect(parseBalanceFilters()).toMatchObject({
      quantityState: 'POSITIVE',
      sortBy: 'item',
      sortOrder: 'asc',
      page: 1,
      limit: 50,
      itemActive: undefined,
      locationActive: undefined,
    });
    expect(
      parseBalanceFilters({
        itemIds: ['1', '1', '2'],
        minQuantity: '0',
        maxQuantity: new Prisma.Decimal('3.125'),
        quantityState: 'ALL',
      }),
    ).toMatchObject({ itemIds: [1n, 2n], quantityState: 'ALL' });
  });
  it.each([
    null,
    [],
    { unknown: 1 },
    { itemId: '1', itemIds: ['1'] },
    { locationId: '1', locationIds: ['2'] },
    { itemIds: [] },
    { locationIds: '1' },
    { itemIds: [1] },
    { itemIds: Array(1001).fill('1') },
    { itemActive: 'true' },
    { locationActive: null },
    { quantityState: null },
    { quantityState: 'NEGATIVE' },
    { sortBy: 'id' },
    { sortOrder: 'DESC' },
    { page: 0 },
    { page: 1.5 },
    { page: '1' },
    { limit: 101 },
    { page: Number.MAX_SAFE_INTEGER },
    { minQuantity: '-1' },
    { minQuantity: '10', maxQuantity: '9' },
  ])('rejects invalid filters %p', (value) => {
    expect(() => parseBalanceFilters(value as BalanceFilters)).toThrow(
      HttpException,
    );
  });
  it('requires a transaction client rather than a root Prisma client', () => {
    for (const value of [null, {}, { $queryRaw() {}, $connect() {} }])
      expect(
        errorCode(() =>
          assertStockTransaction(value as unknown as Prisma.TransactionClient),
        ),
      ).toBe('WAREHOUSE_STOCK_TRANSACTION_REQUIRED');
  });
});
