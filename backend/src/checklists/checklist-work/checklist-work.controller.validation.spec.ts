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
import { ChecklistResult } from '@prisma/client';
import { createPermissionsHttpFixture } from '../../auth/permissions-http.fixture';
import { ChecklistWorkController } from './checklist-work.controller';
import { ChecklistWorkService } from './checklist-work.service';

const operations = [
  { method: 'GET', suffix: '', action: 'get', body: undefined },
  { method: 'POST', suffix: '/start', action: 'start', body: { version: 1 } },
  {
    method: 'PATCH',
    suffix: '/answers',
    action: 'saveAnswers',
    body: { version: 1, answers: [], result: null },
  },
  {
    method: 'POST',
    suffix: '/complete',
    action: 'complete',
    body: { version: 1, result: ChecklistResult.WITH_REMARKS },
  },
];
describe('Checklist work route ID validation', () => {
  let http: Awaited<ReturnType<typeof createPermissionsHttpFixture>>;
  const service = Object.fromEntries(
    operations.map((op) => [
      op.action,
      jest.fn<Promise<object>, unknown[]>().mockResolvedValue({}),
    ]),
  );
  beforeAll(async () => {
    http = await createPermissionsHttpFixture({
      controllers: [ChecklistWorkController],
      providers: [{ provide: ChecklistWorkService, useValue: service }],
    });
  });
  afterAll(async () => {
    await http?.app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    http.modules.splice(0, http.modules.length, 'equipment');
  });
  describe.each(['0', '-1', '9007199254740992'])('invalid work ID %s', (id) => {
    it.each(operations)(
      'rejects $method /:id$suffix before the service',
      async (operation) => {
        const response = await http.request(
          { ...operation, path: `/api/checklists/${id}${operation.suffix}` },
          'operator',
        );
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({
          code: 'ROUTE_ID_INVALID',
        });
        for (const mock of Object.values(service))
          expect(mock).not.toHaveBeenCalled();
      },
    );
  });
  it.each(operations)(
    'accepts a valid ID on $method /:id$suffix',
    async (operation) => {
      const response = await http.request(
        { ...operation, path: `/api/checklists/1${operation.suffix}` },
        'operator',
      );
      expect(response.status).toBe(operation.method === 'POST' ? 201 : 200);
      expect(service[operation.action]).toHaveBeenCalledWith(
        1,
        ...(operation.action === 'get'
          ? [{ userId: 'actor' }]
          : [operation.body, 'actor']),
      );
    },
  );
});
