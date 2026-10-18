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

describe('PPE controller input validation', () => {
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

  const routes = operations.flatMap((operation) =>
    [...operation.path.matchAll(/\/1(?=\/|$)/g)].map((match, index) => ({
      ...operation,
      parameter: index + 1,
      offset: match.index + 1,
    })),
  );
  describe.each(['0', '-1', '9007199254740992'])(
    'invalid PPE route ID %s',
    (id) => {
      it.each(routes)(
        'rejects parameter $parameter on $method $path before calling any service',
        async (operation) => {
          const path =
            operation.path.slice(0, operation.offset) +
            id +
            operation.path.slice(operation.offset + 1);
          const response = await http.request({ ...operation, path }, 'admin');
          expect(response.status).toBe(400);
          expect(await response.json()).toMatchObject({
            code: 'ROUTE_ID_INVALID',
          });
          http.expectNoServiceCalls();
        },
      );
    },
  );
  it('keeps parameter and query validation behind authorization', async () => {
    const invalid = {
      ...operations.find((op) => op.action === 'findItem')!,
      path: '/api/ppe/items/invalid',
    };
    expect((await http.request(invalid, 'engineer')).status).toBe(403);
    expect((await http.request(invalid, 'admin')).status).toBe(400);
    const norm = {
      ...operations.find((op) => op.action === 'findEffectiveNorm')!,
      path: '/api/ppe/positions/1/norm?date=invalid',
    };
    expect((await http.request(norm, 'admin')).status).toBe(400);
    http.expectNoServiceCalls();
  });
});
