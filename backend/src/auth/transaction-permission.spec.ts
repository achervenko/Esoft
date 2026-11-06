import { assertTransactionPermission } from './transaction-permission';
import type { Prisma } from '@prisma/client';
import { getUserPermissions } from './permission-policy';
it('rejects a retired exchange role, including transactional import', async () => {
  const tx = {
    $queryRaw: jest
      .fn()
      .mockResolvedValue([{ role: 'system:receipt-exchange', banned: false }]),
  } as unknown as Prisma.TransactionClient;
  await expect(
    assertTransactionPermission(
      tx,
      'system',
      'warehouse.receipts.integration',
      'source-a',
    ),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    assertTransactionPermission(tx, 'system', 'users.manage'),
  ).rejects.toMatchObject({ status: 403 });
  expect(getUserPermissions('system:receipt-exchange')).toEqual([]);
});

it('requires a grant for the exact source and denies missing scope or banned system authors', async () => {
  const rows = [{ role: 'system:integration', banned: false }];
  const grant = jest.fn().mockImplementation(
    ({
      where,
    }: {
      where: {
        permission: string;
        sourceActor: { source: { code: string } };
      };
    }) =>
      Promise.resolve(
        where.permission === 'warehouse.receipts.integration' &&
          where.sourceActor.source.code === 'source-a'
          ? { sourceId: 'source-a-id' }
          : null,
      ),
  );
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue(rows),
    systemActorPermission: { findFirst: grant },
  } as unknown as Prisma.TransactionClient;
  await expect(
    assertTransactionPermission(
      tx,
      'system',
      'warehouse.receipts.integration',
      'source-a',
    ),
  ).resolves.toBeUndefined();
  await expect(
    assertTransactionPermission(
      tx,
      'system',
      'warehouse.receipts.integration',
      'source-b',
    ),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    assertTransactionPermission(tx, 'system', 'warehouse.receipts.integration'),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    assertTransactionPermission(tx, 'system', 'users.manage', 'source-a'),
  ).rejects.toMatchObject({ status: 403 });
  rows[0].banned = true;
  await expect(
    assertTransactionPermission(
      tx,
      'system',
      'warehouse.receipts.integration',
      'source-a',
    ),
  ).rejects.toMatchObject({ status: 403 });
  expect(getUserPermissions('system:integration')).toEqual([]);
});
