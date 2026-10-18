jest.mock('./users-admin-credential-account', () => ({
  hashUserPassword: jest.fn().mockResolvedValue('hash'),
  createCredentialAccount: jest.fn().mockResolvedValue(undefined),
}));
import { Prisma } from '@prisma/client';
import { isPrismaTransactionConflict } from '../prisma/prisma-transaction-conflict';
import { UserStatusAdminService } from './user-status-admin.service';
import { UserAccountsAdminService } from './user-accounts-admin.service';

const error = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError('transaction failure', {
    code,
    meta,
    clientVersion: 'test',
  });
const conflicts = [
  error('P2034'),
  ...['40001', '40P01'].flatMap((code) => [
    error('P2010', { code }),
    error('P2010', { driverAdapterError: { cause: { originalCode: code } } }),
  ]),
];
const otherErrors = [
  error('P2003'),
  error('P2010', { code: '23505' }),
  error('P2010'),
  new Error('database unavailable'),
  null,
];

describe('Prisma transaction conflict classification', () => {
  it.each(conflicts)('recognizes transaction conflict %p', (failure) => {
    expect(isPrismaTransactionConflict(failure)).toBe(true);
  });
  it.each(otherErrors)('does not retry unrelated failure %p', (failure) => {
    expect(isPrismaTransactionConflict(failure)).toBe(false);
  });
});

describe.each(['status', 'account'] as const)(
  '%s admin transaction retries',
  (kind) => {
    function fixture() {
      const prisma = {
        $transaction: jest
          .fn<Promise<{ id: string }>, [unknown, unknown]>()
          .mockResolvedValue({ id: 'target' }),
      };
      const invoke =
        kind === 'status'
          ? () =>
              new UserStatusAdminService(
                {} as never,
                prisma as never,
              ).setUserStatus({
                userId: 'target',
                currentUserId: 'actor',
                banned: true,
              })
          : () =>
              new UserAccountsAdminService(
                {
                  assertUserExists: jest.fn().mockResolvedValue(undefined),
                } as never,
                {} as never,
                prisma as never,
                [],
              ).updateUser(
                'target',
                {
                  email: 'target@example.test',
                  username: 'target',
                  employeeId: 1,
                  role: 'auditor',
                },
                'actor',
              );
      return { prisma, invoke };
    }
    it.each(conflicts)('retries a recognized conflict %p', async (failure) => {
      const { prisma, invoke } = fixture();
      prisma.$transaction.mockRejectedValueOnce(failure);
      await expect(invoke()).resolves.toEqual({ id: 'target' });
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      for (const call of prisma.$transaction.mock.calls)
        expect(call[1]).toEqual({
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
    });
    it.each(conflicts)(
      'stops after the second conflict %p',
      async (failure) => {
        const { prisma, invoke } = fixture();
        prisma.$transaction.mockRejectedValue(failure);
        await expect(invoke()).rejects.toBe(failure);
        expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      },
    );
    it.each(otherErrors)(
      'does not retry unrelated failure %p',
      async (failure) => {
        const { prisma, invoke } = fixture();
        prisma.$transaction.mockRejectedValue(failure);
        await expect(invoke()).rejects.toBe(failure);
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      },
    );
  },
);
