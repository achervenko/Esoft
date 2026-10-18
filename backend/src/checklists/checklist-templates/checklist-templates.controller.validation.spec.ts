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
import { createChecklistHttpFixture } from '../checklists-http.spec-fixtures';

describe('Checklist template route ID validation', () => {
  let http: Awaited<ReturnType<typeof createChecklistHttpFixture>>;
  beforeAll(async () => {
    http = await createChecklistHttpFixture();
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
  describe.each(['0', '-1', '9007199254740992'])(
    'invalid template ID %s',
    (id) => {
      it.each([
        { method: 'GET', suffix: '' },
        { method: 'POST', suffix: '/archive' },
      ])(
        'rejects $method /:id$suffix before the service',
        async ({ method, suffix }) => {
          const response = await http.request(
            {
              path: `/api/checklist-templates/${id}${suffix}`,
              method,
              body:
                method === 'POST'
                  ? { reason: 'Obsolete', version: 1 }
                  : undefined,
            },
            'admin',
          );
          expect(response.status).toBe(400);
          expect(await response.json()).toMatchObject({
            code: 'ROUTE_ID_INVALID',
          });
          http.expectNoServiceCalls();
        },
      );
    },
  );
});
