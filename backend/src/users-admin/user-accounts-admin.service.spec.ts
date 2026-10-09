import { UserAccountsAdminService } from './user-accounts-admin.service';
import { UsersAdminAssertionsService } from './users-admin-assertions.service';

jest.mock('./users-admin-credential-account', () => ({
  hashUserPassword: jest.fn().mockResolvedValue('hash'),
  createCredentialAccount: jest.fn().mockResolvedValue(undefined),
}));

const payload = {
  email: 'ivan@example.com',
  username: 'ivan',
  password: 'password',
  employeeId: 1,
  role: 'engineer',
};

function createService() {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 1, isActive: false }]),
    user: {
      create: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    employeeUser: { create: jest.fn(), upsert: jest.fn() },
  };
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }) },
    $transaction: jest.fn((operation: (value: typeof tx) => unknown) =>
      operation(tx),
    ),
  };
  const assertions = new UsersAdminAssertionsService(prisma as never);
  return {
    tx,
    prisma,
    service: new UserAccountsAdminService(
      assertions,
      {} as never,
      prisma as never,
    ),
  };
}

describe('UserAccountsAdminService employee activity', () => {
  it.each(['create', 'update'])(
    'rejects %s when the employee is inactive inside the transaction',
    async (operation) => {
      const { service, tx, prisma } = createService();
      const result =
        operation === 'create'
          ? service.createUser(payload)
          : service.updateUser('user-1', payload);
      await expect(result).rejects.toMatchObject({
        response: { code: 'EMPLOYEE_INACTIVE' },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(
        (tx.$queryRaw.mock.calls[0] as [TemplateStringsArray])[0].join(''),
      ).toContain('FOR UPDATE');
      expect(tx.user.create).not.toHaveBeenCalled();
      expect(tx.user.update).not.toHaveBeenCalled();
      expect(tx.employeeUser.create).not.toHaveBeenCalled();
      expect(tx.employeeUser.upsert).not.toHaveBeenCalled();
    },
  );

  it.each(['create', 'update'])(
    'rejects %s when the employee no longer exists',
    async (operation) => {
      const { service, tx } = createService();
      tx.$queryRaw.mockResolvedValue([]);
      const result =
        operation === 'create'
          ? service.createUser(payload)
          : service.updateUser('user-1', payload);
      await expect(result).rejects.toMatchObject({
        response: { code: 'EMPLOYEE_NOT_FOUND' },
      });
      expect(tx.employeeUser.create).not.toHaveBeenCalled();
      expect(tx.employeeUser.upsert).not.toHaveBeenCalled();
    },
  );
});
