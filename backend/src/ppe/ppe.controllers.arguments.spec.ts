jest.mock('@thallesp/nestjs-better-auth', () => {
  const common =
    jest.requireActual<typeof import('@nestjs/common')>('@nestjs/common');
  return {
    Session: common.createParamDecorator(
      (_data: unknown, context: ExecutionContext) =>
        context.switchToHttp().getRequest<{ session: unknown }>().session,
    ),
  };
});

import type { ExecutionContext } from '@nestjs/common';
import { createPpeHttpFixture, operations } from './ppe-http.spec-fixtures';

describe('PPE controller service arguments', () => {
  let http: Awaited<ReturnType<typeof createPpeHttpFixture>>;
  beforeAll(async () => {
    http = await createPpeHttpFixture();
  });
  afterAll(async () => {
    await http?.app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    http.modules.splice(
      0,
      http.modules.length,
      'equipment',
      'ppe',
      'warehouse',
    );
  });
  it('forwards mutation payloads, IDs and audit actors', async () => {
    const payload = { test: 'payload' };
    for (const operation of operations.filter((op) => op.method !== 'GET')) {
      jest.clearAllMocks();
      expect((await http.request(operation, 'admin', payload)).status).toBe(
        operation.method === 'POST' ? 201 : 200,
      );
      const calls = http.services[operation.group][operation.action].mock.calls;
      expect(calls).toHaveLength(1);
      const args = calls[0];
      expect(args.at(-1)).toEqual(
        ['createRegular', 'createExtra'].includes(operation.action)
          ? { userId: 'actor', role: 'admin' }
          : 'actor',
      );
      if (operation.method !== 'DELETE') expect(args).toContainEqual(payload);
      if (operation.path.includes('/1')) expect(args[0]).toBe(1);
    }
  });
  it('forwards only effective roles to issuance services', async () => {
    http.modules.splice(0, http.modules.length, 'ppe');
    for (const action of ['createRegular', 'createExtra']) {
      const operation = operations.find((op) => op.action === action)!;
      expect(
        (await http.request(operation, 'accounting_specialist,engineer'))
          .status,
      ).toBe(201);
      expect(http.services.issues[action]).toHaveBeenCalledWith(
        {},
        { userId: 'actor', role: 'accounting_specialist' },
      );
    }
  });
});
