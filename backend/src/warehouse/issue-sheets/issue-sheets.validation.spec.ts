import { Prisma } from '@prisma/client';
import { ConflictException } from '@nestjs/common';
import {
  parseCreateSheet,
  parseSheetFilters,
  parseLineFilters,
  parseSheetLine,
} from './issue-sheets.validation';
import { assertSheetOpen, lineProgress } from './issue-sheets.model';

describe('IssueSheets input contract', () => {
  it('allows only known open sheet states', () => {
    for (const status of ['DRAFT', 'READY', 'IN_PROGRESS']) {
      expect(() => assertSheetOpen(status)).not.toThrow();
    }
  });
  it.each([
    ['PROCESSED', 'WAREHOUSE_ISSUE_SHEET_CLOSED'],
    ['PROCESSED_WITH_SHORTAGE', 'WAREHOUSE_ISSUE_SHEET_CLOSED'],
    ['CANCELLED', 'WAREHOUSE_ISSUE_SHEET_CLOSED'],
    ['UNKNOWN', 'WAREHOUSE_ISSUE_SHEET_STATE'],
    ['', 'WAREHOUSE_ISSUE_SHEET_STATE'],
  ])('rejects state %s with code %s', (status, code) => {
    expect.assertions(2);
    try {
      assertSheetOpen(status);
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code,
      });
    }
  });
  it('uses the same SHA-256 validation for metadata and filtering', () => {
    const hash = 'Ab12'.repeat(16);
    expect(parseSheetFilters({ sourceFileHash: hash }).sourceFileHash).toBe(
      hash.toLowerCase(),
    );
    expect(
      parseCreateSheet({ warehouseId: '1', name: 'Лист', sourceFileHash: hash })
        .sourceFileHash,
    ).toBe(hash.toLowerCase());
    for (const sourceFileHash of ['abc', 'g'.repeat(64), 'a'.repeat(65)]) {
      expect(() => parseSheetFilters({ sourceFileHash })).toThrow();
      expect(() =>
        parseCreateSheet({ warehouseId: '1', name: 'Лист', sourceFileHash }),
      ).toThrow();
    }
  });
  it('normalizes metadata without allowing the client to set status or actor', () => {
    expect(
      parseCreateSheet({
        warehouseId: '1',
        name: ' Лист ',
        sourceFileHash: 'A'.repeat(64),
      }),
    ).toEqual({
      warehouseId: 1n,
      name: 'Лист',
      sourceFileName: null,
      sourceFileHash: 'a'.repeat(64),
    });
    for (const body of [
      { name: '' },
      { name: 'X', status: 'READY' },
      { name: 'X', createdByUserId: 'other' },
      { name: 'X', sourceFileHash: 'bad' },
    ])
      expect(() => parseCreateSheet(body)).toThrow();
  });
  it('preserves bigint IDs and decimal precision', () => {
    const row = parseSheetLine(
      {
        itemId: '9007199254740993',
        quantity: '20.125',
        rowNumber: 1,
        sourceName: ' Исходное имя ',
      },
      true,
    );
    expect(row.itemId).toBe(9007199254740993n);
    expect(row.quantity?.toString()).toBe('20.125');
    expect(row.matchingStatus).toBe('UNMATCHED');
    expect(row.sourceName).toBe('Исходное имя');
  });
  it.each(['0', '-1', '1.0001', '1e3', 'NaN', 1, undefined])(
    'rejects invalid quantities %s',
    (quantity) => {
      expect(() => parseSheetLine({ quantity, rowNumber: 1 }, true)).toThrow();
    },
  );
  it('does not allow editing source fields or row numbers', () => {
    for (const field of [
      'sourceArticle',
      'sourceName',
      'sourceLocation',
      'sourceProject',
      'rowNumber',
    ])
      expect(() => parseSheetLine({ [field]: 'new' }, false)).toThrow();
    expect(() => parseSheetLine({}, false)).toThrow();
  });
  it('parses all filter families and rejects unknown inputs', () => {
    expect(
      parseSheetFilters({
        statuses: 'READY,IN_PROGRESS',
        hasShortage: 'false',
        page: '2',
        limit: '10',
      }),
    ).toMatchObject({
      statuses: ['READY', 'IN_PROGRESS'],
      hasShortage: false,
      page: 2,
      limit: 10,
    });
    expect(
      parseLineFilters({
        matchingStatuses: ['MATCHED'],
        executionState: 'PARTIAL',
        rowFrom: '2',
        rowTo: '5',
      }),
    ).toMatchObject({
      matchingStatuses: ['MATCHED'],
      executionState: 'PARTIAL',
      rowFrom: 2,
      rowTo: 5,
    });
    for (const query of [
      { statuses: 'BAD' },
      { hasErrors: 'yes' },
      { limit: 101 },
      { sortBy: 'id;DROP' },
      { createdFrom: '2026-02-30' },
      { createdFrom: '2026-10-02', createdTo: '2026-10-01' },
      { extra: true },
    ])
      expect(() => parseSheetFilters(query)).toThrow();
    expect(() => parseLineFilters({ rowFrom: 5, rowTo: 2 })).toThrow();
  });
  it('rejects overissued progress instead of reporting completion', () => {
    try {
      lineProgress(new Prisma.Decimal('20'), new Prisma.Decimal('20.001'));
      throw new Error('Expected overissue rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'WAREHOUSE_ISSUE_SHEET_OVERISSUED',
      });
    }
  });
  it.each([
    ['0', '20', 'NOT_STARTED'],
    ['12', '8', 'PARTIAL'],
    ['20', '0', 'COMPLETED'],
  ])(
    'calculates exact progress for %s issued',
    (issued, remaining, executionState) => {
      expect(
        lineProgress(new Prisma.Decimal('20'), new Prisma.Decimal(issued)),
      ).toEqual({
        requiredQuantity: '20',
        issuedQuantity: issued,
        remainingQuantity: remaining,
        executionState,
      });
    },
  );
});

it('requires a warehouse on sheet creation and validates its list filter', () => {
  expect(() => parseCreateSheet({ name: 'Missing warehouse' })).toThrow();
  expect(() =>
    parseCreateSheet({ name: 'Invalid warehouse', warehouseId: '0' }),
  ).toThrow();
  expect(
    parseSheetFilters({ warehouseId: '9007199254740993' }).warehouseId,
  ).toBe(9007199254740993n);
  expect(() => parseSheetFilters({ warehouseId: '0' })).toThrow();
});
