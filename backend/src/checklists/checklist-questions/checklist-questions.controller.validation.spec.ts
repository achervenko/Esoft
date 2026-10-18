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
import type { HttpOperation } from '../../auth/permissions-http.fixture';

describe('Checklist question HTTP validation', () => {
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
  const request = (operation: HttpOperation, role?: string) =>
    http.request(operation, role);
  const expectNoServiceCalls = () => http.expectNoServiceCalls();
  it('accepts the canonical module filter and rejects unknown fields before the service', async () => {
    const operation: HttpOperation = {
      path: '/api/checklist-questions?checklistModuleId=3',
      method: 'GET',
    };
    expect((await request(operation, 'admin')).status).toBe(200);
    expect(http.services[1].list).toHaveBeenCalledWith(
      expect.objectContaining({ checklistModuleId: 3 }),
    );
    jest.clearAllMocks();
    for (const query of ['moduleId=3', 'checklistModuleId=3&moduleId=3']) {
      const response = await request(
        { ...operation, path: '/api/checklist-questions?' + query },
        'admin',
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        code: 'CHECKLIST_QUESTION_QUERY_FIELD_UNKNOWN',
      });
    }
    expectNoServiceCalls();
  });
  describe.each(['0', '-1', '9007199254740992'])(
    'invalid question ID %s',
    (id) => {
      it.each([
        { method: 'GET', suffix: '' },
        { method: 'PATCH', suffix: '' },
        { method: 'POST', suffix: '/activate' },
        { method: 'POST', suffix: '/deactivate' },
      ])(
        'rejects $method /:id$suffix before the service',
        async ({ method, suffix }) => {
          const response = await request(
            {
              path: `/api/checklist-questions/${id}${suffix}`,
              method,

              body:
                method === 'PATCH'
                  ? { questionText: 'Valid question' }
                  : undefined,
            },
            'admin',
          );
          expect(response.status).toBe(400);
          expect(await response.json()).toMatchObject({
            code: 'ROUTE_ID_INVALID',
          });
          expectNoServiceCalls();
        },
      );
    },
  );
});
