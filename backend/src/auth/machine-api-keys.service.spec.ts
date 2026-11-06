jest.mock('@thallesp/nestjs-better-auth', () => ({ AuthService: class {} }));
import type { AuthService } from '@thallesp/nestjs-better-auth';
import type { Auth } from './auth.config';
import type { PrismaService } from '../prisma/prisma.service';
import { MachineApiKeysService } from './machine-api-keys.service';
import type { Prisma } from '@prisma/client';
import type { MachineKeyScope } from './machine-api-key.contract';

function fixture(
  result: unknown = {
    valid: true,
    key: { id: 'id', referenceId: 'technical-user', metadata: {} },
  },
) {
  const api = { verifyApiKey: jest.fn().mockResolvedValue(result) };
  return {
    api,
    service: new MachineApiKeysService(
      { api } as unknown as AuthService<Auth>,
      {} as PrismaService,
    ),
  };
}
it('verifies a machine key using the requested permissions without creating a session', async () => {
  const { api, service } = fixture();
  await service.verifyBearer('Bearer secret', { transport: ['event:create'] });
  expect(api.verifyApiKey).toHaveBeenCalledWith({
    body: {
      configId: 'machine',
      key: 'secret',
      permissions: { transport: ['event:create'] },
    },
  });
});
it.each([undefined, '', 'Basic key', 'Bearer key with spaces'])(
  'rejects missing/malformed authorization %p',
  async (authorization) => {
    const { api, service } = fixture();
    await expect(service.verifyBearer(authorization, {})).rejects.toMatchObject(
      { status: 401 },
    );
    expect(api.verifyApiKey).not.toHaveBeenCalled();
  },
);
it.each([
  'KEY_NOT_FOUND',
  'KEY_DISABLED',
  'KEY_EXPIRED',
  'INSUFFICIENT_API_KEY_PERMISSIONS',
  'INVALID_API_KEY',
])('rejects failed plugin verification %s', async (code) => {
  const { service } = fixture({ valid: false, key: null, error: { code } });
  await expect(service.verifyBearer('Bearer secret', {})).rejects.toMatchObject(
    { status: 401, response: { code: 'MACHINE_KEY_INVALID' } },
  );
});
it('preserves rate limiting as HTTP 429', async () => {
  const { service } = fixture({
    valid: false,
    key: null,
    error: { code: 'RATE_LIMITED' },
  });
  await expect(service.verifyBearer('Bearer secret', {})).rejects.toMatchObject(
    { status: 429 },
  );
});

it('does not disguise an internal plugin failure as invalid credentials', async () => {
  const { service } = fixture({
    valid: false,
    key: null,
    error: {
      code: 'INVALID_API_KEY',
      message: { code: 'INVALID_API_KEY', message: 'Invalid API key.' },
    },
  });
  await expect(service.verifyBearer('Bearer secret', {})).rejects.toMatchObject(
    { status: 503, response: { code: 'MACHINE_KEY_VERIFICATION_UNAVAILABLE' } },
  );
});

it('rejects a root Prisma client instead of silently issuing outside the transaction', async () => {
  const { service } = fixture();
  await expect(
    service.create('user', 'name', 86400, {}, {}, {
      $connect: jest.fn(),
    } as unknown as Prisma.TransactionClient),
  ).rejects.toThrow('Expected a transaction client');
});

const sourceScope = { purpose: 'integration', sourceId: 'source-a' };
function scopedFixture(metadata: (string | null)[]) {
  const rows = metadata.map((value, index) => ({
    id: String(index),
    name: 'Key',
    enabled: true,
    expiresAt: null,
    createdAt: new Date(0),
    metadata: value,
  }));
  const apiKey = {
    findMany: jest.fn().mockResolvedValue(rows),
    findFirst: jest.fn().mockResolvedValue(rows[0] ?? null),
    update: jest.fn(),
  };
  const service = new MachineApiKeysService(
    {} as AuthService<Auth>,
    { apiKey } as unknown as PrismaService,
  );
  return {
    apiKey,
    service,
    tx: { apiKey } as unknown as Prisma.TransactionClient,
  };
}
it('lists only keys of the requested source and purpose and skips malformed metadata', async () => {
  const { apiKey, service } = scopedFixture([
    JSON.stringify(sourceScope),
    JSON.stringify({ ...sourceScope, sourceId: 'source-b' }),
    JSON.stringify({ ...sourceScope, purpose: 'other' }),
    null,
    '{}',
    '[]',
    '"text"',
    '{',
  ]);
  await expect(service.list('shared-actor', sourceScope)).resolves.toEqual([
    {
      id: '0',
      name: 'Key',
      enabled: true,
      expiresAt: null,
      createdAt: new Date(0),
    },
  ]);
  expect(apiKey.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { referenceId: 'shared-actor', configId: 'machine' },
    }),
  );
});
it.each([
  undefined,
  {},
  { purpose: 'integration' },
  { purpose: '', sourceId: 'source-a' },
  { purpose: 'integration', sourceId: ' ' },
])('rejects missing scope before accessing keys: %p', async (value) => {
  const { apiKey, service, tx } = scopedFixture([]),
    scope = value as MachineKeyScope;
  await expect(service.list('shared-actor', scope)).rejects.toMatchObject({
    status: 401,
    response: { code: 'MACHINE_KEY_INVALID' },
  });
  await expect(
    service.revokeInTransaction(tx, 'key', 'shared-actor', scope),
  ).rejects.toMatchObject({ status: 401 });
  expect(apiKey.findMany).not.toHaveBeenCalled();
  expect(apiKey.findFirst).not.toHaveBeenCalled();
  expect(apiKey.update).not.toHaveBeenCalled();
});
it.each([
  JSON.stringify({ ...sourceScope, sourceId: 'source-b' }),
  JSON.stringify({ ...sourceScope, purpose: 'other' }),
  null,
  '{}',
  '{',
])('does not revoke keys outside the requested scope: %p', async (metadata) => {
  const { apiKey, service, tx } = scopedFixture([metadata]);
  await expect(
    service.revokeInTransaction(tx, 'key', 'shared-actor', sourceScope),
  ).rejects.toMatchObject({ status: 401 });
  expect(apiKey.update).not.toHaveBeenCalled();
});
it('revokes the owned key within the requested source', async () => {
  const { apiKey, service, tx } = scopedFixture([JSON.stringify(sourceScope)]);
  await service.revokeInTransaction(tx, 'key', 'shared-actor', sourceScope);
  expect(apiKey.findFirst).toHaveBeenCalledWith({
    where: { id: 'key', referenceId: 'shared-actor', configId: 'machine' },
    select: { metadata: true },
  });
  expect(apiKey.update).toHaveBeenCalledWith({
    where: { id: 'key' },
    data: { enabled: false },
  });
});
