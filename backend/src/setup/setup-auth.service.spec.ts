jest.mock('@thallesp/nestjs-better-auth', () => ({ AuthService: class {} }));
import { AuthService } from '@thallesp/nestjs-better-auth';
import { SetupAuthService } from './setup-auth.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { Auth } from '../auth/auth.config';

it('creates the initial administrator through the injected auth instance', async () => {
  const auth = {
    api: {
      createUser: jest
        .fn<Promise<{ user: { id: string } }>, [unknown]>()
        .mockResolvedValue({ user: { id: 'admin-id' } }),
    },
  };
  const service = new SetupAuthService(
    {} as PrismaService,
    auth as unknown as AuthService<Auth>,
  );
  const user = await service.createInitialAdminUser(
    {
      email: 'admin@example.test',
      username: 'admin',
      password: 'test-password',
      employee: { firstName: 'Иван', lastName: 'Иванов', middleName: null },
    },
    {
      id: 1,
      first_name: 'Иван',
      last_name: 'Иванов',
      middle_name: null,
      position: 'Администратор',
    },
  );
  expect(user.id).toBe('admin-id');
  expect(auth.api.createUser).toHaveBeenCalledTimes(1);
  expect(auth.api.createUser.mock.calls[0][0]).toMatchObject({
    body: {
      role: 'admin',
      email: 'admin@example.test',
      name: 'Иванов Иван',
    },
  });
});
