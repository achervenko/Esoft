jest.mock('./machine-api-key.plugin', () => ({
  machineApiKeyPlugin: () => ({ id: 'api-key' }),
  machineKeyDisabledPaths: [],
}));
jest.mock('better-auth/plugins', () => ({
  admin: () => ({ id: 'admin' }),
  username: () => ({ id: 'username' }),
  customSession: () => ({ id: 'custom-session' }),
}));
jest.mock('./role-aware-prisma-adapter', () => ({
  roleAwarePrismaAdapter: jest.fn(() => 'adapter'),
}));
jest.mock('./role-availability.hooks', () => ({
  createRoleRequestHook: jest.fn(),
  createRoleAvailabilityHooks: () => ({}),
}));
jest.mock('./better-auth-access', () => ({}));
jest.mock('better-auth', () => ({
  betterAuth: jest.fn((options: unknown) => ({ options })),
}));
jest.mock('../config/root-environment', () => ({
  loadRootConfig: jest.fn(() => ({
    auth: { secret: 'auth-factory-test-secret', url: 'http://localhost:3000' },
    frontend: { url: 'http://localhost:5173' },
    nodeEnv: 'test',
  })),
}));
import { betterAuth } from 'better-auth';
import { createAuth } from './auth.config';
import { loadRootConfig } from '../config/root-environment';
import type { PrismaService } from '../prisma/prisma.service';

it('imports the auth factory without creating auth or loading configuration', () => {
  expect(betterAuth).not.toHaveBeenCalled();
  expect(loadRootConfig).not.toHaveBeenCalled();
});

it('creates auth explicitly and uses the supplied Prisma for the login hook', async () => {
  const prisma = {
    user: {
      update: jest
        .fn<
          Promise<unknown>,
          [{ where: { id: string }; data: { lastLoginAt: Date } }]
        >()
        .mockResolvedValue({}),
    },
  };
  createAuth(prisma as unknown as PrismaService, []);
  expect(betterAuth).toHaveBeenCalledTimes(1);
  const options = jest.mocked(betterAuth).mock.calls[0][0];
  expect(options.baseURL).toBe('http://localhost:3000');
  await options.databaseHooks!.session!.create!.after!(
    { userId: 'user-id' } as never,
    null,
  );
  expect(prisma.user.update).toHaveBeenCalledTimes(1);
  const updated = prisma.user.update.mock.calls[0][0];
  expect(updated.where).toEqual({ id: 'user-id' });
  expect(updated.data.lastLoginAt).toBeInstanceOf(Date);
});
