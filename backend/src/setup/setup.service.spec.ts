jest.mock('../auth/auth.config', () => ({
  auth: { api: { createUser: jest.fn() } },
}));
import { SetupService } from './setup.service';
import { SetupStateService } from './setup-state.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { SetupAuthService } from './setup-auth.service';
import type { CreateInitialAdminInput } from './setup.types';
const input: CreateInitialAdminInput = {
  email: 'admin@example.test',
  username: 'admin',
  password: 'Secure1234',
  employee: { lastName: 'Иванов', firstName: 'Иван', middleName: null },
};
function fixture() {
  const employee = { id: 7, ...input.employee };
  let persisted: unknown[] = [];
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 1, name: 'Админ' }]),
    employee: {
      create: jest.fn().mockImplementation((args: unknown) => {
        persisted.push(args);
        return Promise.resolve(employee);
      }),
    },
    employeeUser: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<void>) => {
      try {
        return await fn(tx);
      } catch (error) {
        persisted = [];
        throw error;
      }
    }),
  };
  const state = new SetupStateService(prisma as unknown as PrismaService);
  jest.spyOn(state, 'assertSetupRequired').mockResolvedValue(undefined);
  jest
    .spyOn(state, 'assertEmailAndUsernameAvailable')
    .mockResolvedValue(undefined);
  const auth = {
    createInitialAdminUser: jest.fn().mockResolvedValue({ id: 'user-1' }),
    cleanupCreatedAuthUser: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { logInitialAdminCreated: jest.fn().mockResolvedValue({}) };
  const service = new SetupService(
    audit,
    auth as unknown as SetupAuthService,
    prisma as unknown as PrismaService,
    state,
  );
  return { service, tx, state, auth, audit, persisted: () => persisted };
}
it('creates employee under setup transaction and links the administrator', async () => {
  const f = fixture();
  await f.service.createInitialAdmin(input, {});
  const calls = f.tx.employee.create.mock.calls as Array<
    [{ data: Record<string, unknown> }]
  >;
  expect(calls[0][0].data).toMatchObject({
    lastName: 'Иванов',
    positionId: 1,
    isActive: true,
  });
  expect(calls[0][0].data.positionAssignedAt).toBeInstanceOf(Date);
  expect(f.tx.employeeUser.create).toHaveBeenCalledWith({
    data: { employeeId: 7, userId: 'user-1' },
  });
  expect(f.audit.logInitialAdminCreated).toHaveBeenCalledWith(
    f.tx,
    expect.objectContaining({ employeeId: 7 }),
  );
});
it('does not create employees when setup has already completed', async () => {
  const f = fixture();
  jest
    .spyOn(f.state, 'assertSetupRequired')
    .mockRejectedValue(new Error('completed'));
  await expect(f.service.createInitialAdmin(input, {})).rejects.toThrow();
  expect(f.tx.employee.create).not.toHaveBeenCalled();
  expect(f.auth.createInitialAdminUser).not.toHaveBeenCalled();
});
it('rolls back employee creation and compensates auth when linking fails', async () => {
  const f = fixture();
  f.tx.employeeUser.create.mockRejectedValue(new Error('failed'));
  await expect(f.service.createInitialAdmin(input, {})).rejects.toThrow();
  expect(f.persisted()).toEqual([]);
  expect(f.auth.cleanupCreatedAuthUser).toHaveBeenCalledWith('user-1');
});
