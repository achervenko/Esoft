import type { Prisma } from '@prisma/client';
import {
  ensureIntegrationActor,
  INTEGRATION_ACTOR_ROLE,
} from './system-actors';

it('creates or reuses an integration actor with the exact system role', async () => {
  const upsert = jest.fn().mockResolvedValue({ role: INTEGRATION_ACTOR_ROLE });
  const tx = { user: { upsert } } as unknown as Prisma.TransactionClient;
  await expect(ensureIntegrationActor(tx, 'source-id', 'Source')).resolves.toBe(
    'integration:source-id',
  );
  expect(upsert).toHaveBeenCalledWith({
    where: { id: 'integration:source-id' },
    create: {
      id: 'integration:source-id',
      name: 'Source',
      email: 'source-id@integration.invalid',
      role: INTEGRATION_ACTOR_ROLE,
      emailVerified: false,
    },
    update: {},
    select: { role: true },
  });
});

it.each([
  'admin',
  'system:receipt-exchange',
  'system:integration,admin',
  '',
  null,
])(
  'rejects an existing user with role %p without changing the role',
  async (role) => {
    const upsert = jest.fn().mockResolvedValue({ role });
    const tx = { user: { upsert } } as unknown as Prisma.TransactionClient;
    await expect(
      ensureIntegrationActor(tx, 'source-id', 'Source'),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'INTEGRATION_ACTOR_CONFLICT' },
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: {} }),
    );
  },
);
