import { parseStockHttpQuery } from './stock-http.validation';
import { stockId } from './stock.validation';
import { HttpException } from '@nestjs/common';
it.each([
  null,
  [],
  { page: 1 },
  { itemId: ['1', '2'] },
  { minQuantity: 1 },
  { itemIds: [{}] },
  { locationId: '9223372036854775808' },
])('rejects malformed HTTP filters %j', (value) =>
  expect(() => parseStockHttpQuery(value)).toThrow(),
);
it('preserves defaults and validates decimal ID paths', () => {
  expect(parseStockHttpQuery({})).toEqual({});
  expect(stockId('9007199254740993', 'itemId')).toBe(9007199254740993n);
});
it.each(['00015', '015', '0', '+15', '15.0', ' 15', '15 '])(
  'rejects noncanonical ID %s before accessing the database',
  (value) => {
    try {
      stockId(value, 'itemId');
      throw new Error('Expected invalid ID');
    } catch (error: unknown) {
      if (!(error instanceof HttpException)) throw error;
      expect(error.getStatus()).toBe(400);
      expect(error.getResponse()).toMatchObject({
        code: 'WAREHOUSE_STOCK_ID_INVALID',
      });
    }
  },
);
