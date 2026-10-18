import { USER_ROLES, getAssignableRoles } from '../auth/role-module-policy';
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

function createService(activeModules = ['equipment', 'ppe']) {
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
  const audit = { logUserUpdated: jest.fn().mockResolvedValue(undefined) };
  return {
    tx,
    prisma,
    service: new UserAccountsAdminService(
      assertions,
      audit as never,
      prisma as never,
      activeModules,
    ),
  };
}

describe('UserAccountsAdminService employee activity', () => {
  it('returns only assignable roles', () => {
    expect(
      createService([])
        .service.getRoles()
        .map((role) => role.value),
    ).toEqual(getAssignableRoles([]));
  });
  it('preserves an existing unavailable role while editing other account fields', async () => {
    const { service, tx } = createService([]);
    tx.$queryRaw.mockResolvedValue([{ id: 1, isActive: true }]);
    tx.user.findUniqueOrThrow.mockResolvedValue({
      id: 'user-1',
      role: 'engineer',
      email: payload.email,
      name: payload.username,
      username: payload.username,
      displayUsername: payload.username,
      banned: false,
      createdAt: new Date(),
      lastLoginAt: null,
      employeeUser: null,
      photo: null,
    });
    await expect(service.updateUser('user-1', payload)).resolves.toMatchObject({
      role: 'engineer',
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      data: {
        role: 'engineer',
        email: payload.email,
        name: payload.username,
        username: payload.username,
        displayUsername: payload.username,
      },
      where: { id: 'user-1' },
    });
  });
  it.each(USER_ROLES.filter((role) => !getAssignableRoles([]).includes(role)))(
    'rejects creation with disabled role %s before writes',
    async (role) => {
      const { service, prisma } = createService([]);
      await expect(
        service.createUser({ ...payload, role }),
      ).rejects.toMatchObject({ response: { code: 'ROLE_MODULE_DISABLED' } });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );
  it('rejects assigning a disabled role to an existing account', async () => {
    const { service, tx } = createService([]);
    tx.$queryRaw.mockResolvedValue([{ id: 1, isActive: true }]);
    tx.user.findUniqueOrThrow.mockResolvedValue({
      id: 'user-1',
      role: 'operator',
    });
    await expect(service.updateUser('user-1', payload)).rejects.toMatchObject({
      response: { code: 'ROLE_MODULE_DISABLED' },
    });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.employeeUser.upsert).not.toHaveBeenCalled();
  });
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
