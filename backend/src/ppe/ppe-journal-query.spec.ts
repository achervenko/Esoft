import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { loadJournalPage, parseJournalQuery } from './ppe-journal-query';

describe('paged PPE journal', () => {
  it('bounds requests and preserves all filters with escaped literal search words', () => {
    const parsed = parseJournalQuery({
      page: '2',
      limit: '100',
      employeeId: '5',
      status: 'CANCELLED',
      search: 'Ёлкин 3_% 11.10.2026',
      sort: 'quantity',
      direction: 'asc',
    });
    expect(parsed).toMatchObject({ page: 2, limit: 100 });
    expect(parsed.where.values).toEqual([
      5,
      'CANCELLED',
      '%елкин%',
      '%3\\_\\%%',
      '%11.10.2026%',
    ]);
    expect(parsed.where.sql).toContain('journal_search_text LIKE');
    expect(parsed.order.sql).toBe('quantity ASC, id DESC');
  });
  it.each([
    { limit: '101' },
    { page: '0' },
    { page: 'NaN' },
    { sort: '__proto__' },
    { sort: 'quantity;DROP TABLE ppe_issues' },
    { search: 'a'.repeat(201) },
    { direction: 'sideways' },
  ])('rejects unsafe input %j', (query) => {
    expect(() => parseJournalQuery(query)).toThrow();
  });
});

describe('journal page bounds after filtered count', () => {
  const setup = (total: number) => {
    const tx = {
      $queryRaw: jest
        .fn<Promise<unknown[]>, [Prisma.Sql]>()
        .mockResolvedValueOnce([{ total: BigInt(total) }])
        .mockResolvedValue([]),
      ppeIssue: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
    return { tx, prisma, db: prisma as unknown as PrismaService };
  };
  it.each([
    [0, '1'],
    [100000, '1000000'],
    [100, '2'],
  ])(
    'skips sorting and DTO loading for total=%i page=%s',
    async (total, page) => {
      const { tx, prisma, db } = setup(total);
      expect(await loadJournalPage(db, { page, employeeId: '5' })).toEqual({
        items: [],
        total,
        page: Number(page),
        limit: 100,
      });
      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(tx.$queryRaw.mock.calls[0][0].sql).not.toContain('OFFSET');
      expect(tx.$queryRaw.mock.calls[0][0].values).toEqual([5]);
      expect(tx.ppeIssue.findMany).not.toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      });
    },
  );
  it('still queries the last existing page', async () => {
    const { tx, db } = setup(100000);
    tx.$queryRaw.mockResolvedValueOnce([{ id: 99901 }]);
    await loadJournalPage(db, { page: '1000' });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.$queryRaw.mock.calls[1][0].values.slice(-2)).toEqual([
      100, 99900,
    ]);
    expect(tx.ppeIssue.findMany).toHaveBeenCalledWith({
      where: { id: { in: [99901] } },
    });
  });
});
