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
import { createChecklistHttpFixture } from './checklists-http.spec-fixtures';
import type { HttpOperation } from '../auth/permissions-http.fixture';
import { hasPermission } from '../auth/permission-policy';
import { USER_ROLES, getEffectiveUserRoles } from '../auth/role-module-policy';
import { CHECKLISTS_PERMISSIONS } from './checklists.permissions';

type Operation = {
  path: string;
  method: string;
  body?: unknown;
  group: number;
  action: string;
};
const operations: Operation[] = [];
for (const [group, resource] of [
  'modules',
  'questions',
  'templates',
].entries()) {
  const path = '/api/checklist-' + resource;
  operations.push(
    { path, method: 'GET', group, action: 'list' },
    { path: path + '/1', method: 'GET', group, action: 'get' },
  );
  const body =
    resource === 'modules'
      ? { name: 'Module' }
      : resource === 'questions'
        ? {
            questionText: 'Question',
            answerType: 'BOOLEAN',
            checklistModuleId: 1,
          }
        : {
            name: 'Template',
            modules: [
              { checklistModuleId: 1, questions: [{ checklistQuestionId: 1 }] },
            ],
          };
  operations.push({ path, method: 'POST', group, action: 'create', body });
  if (resource === 'templates') {
    operations.push({
      path: path + '/1/archive',
      method: 'POST',
      group,
      action: 'archive',
      body: { reason: 'Obsolete', version: 1 },
    });
  } else {
    operations.push({
      path: path + '/1',
      method: 'PATCH',
      group,
      action: 'update',
      body,
    });
    for (const action of ['activate', 'deactivate'])
      operations.push({
        path: path + '/1/' + action,
        method: 'POST',
        group,
        action,
      });
  }
}
operations.push(
  {
    path: '/api/checklist-modules/reorder',
    method: 'PATCH',
    group: 0,
    action: 'reorder',
    body: { items: [{ id: 1, sortOrder: 1 }] },
  },
  {
    path: '/api/checklist-modules/1/questions/reorder',
    method: 'PATCH',
    group: 1,
    action: 'reorder',
    body: { items: [{ id: 1, sortOrder: 1 }] },
  },
);

describe('Checklist administration permissions through HTTP', () => {
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
  describe.each([
    ...USER_ROLES,
    'unknown',
    'engineer,storekeeper',
    'chief_engineer,storekeeper',
    'admin,operator',
  ])('role %s', (role) => {
    it.each(operations)('$method $path', async (operation) => {
      await expectAccess(operation, role);
    });
  });
  async function expectAccess(operation: Operation, role: string) {
    const effectiveRole = getEffectiveUserRoles(role, http.modules).join(',');
    const allowed = hasPermission(effectiveRole, CHECKLISTS_PERMISSIONS.MANAGE);
    expect((await request(operation, role)).status).toBe(
      allowed ? (operation.method === 'POST' ? 201 : 200) : 403,
    );
    if (allowed)
      expect(
        http.services[operation.group][operation.action],
      ).toHaveBeenCalledTimes(1);
    else expectNoServiceCalls();
  }
  it.each(operations)(
    'requires authentication: $method $path',
    async (operation) => {
      expect((await request(operation)).status).toBe(401);
      expectNoServiceCalls();
    },
  );
  describe.each(['chief_engineer,storekeeper', 'admin,chief_engineer'])(
    'equipment disabled, role %s',
    (role) => {
      it.each(operations)('$method $path', async (operation) => {
        http.modules.splice(0, http.modules.length, 'warehouse');
        await expectAccess(operation, role);
      });
    },
  );
  it('keeps validation behind authorization', async () => {
    const invalid = {
      path: '/api/checklist-modules',
      method: 'POST',
      body: {},
    };
    expect((await request(invalid, 'engineer')).status).toBe(403);
    expect((await request(invalid, 'admin')).status).toBe(400);
    expect(
      (
        await request(
          {
            ...invalid,
            path: '/api/checklist-modules/not-an-id',
            method: 'GET',
            body: undefined,
          },
          'admin',
        )
      ).status,
    ).toBe(400);
    expectNoServiceCalls();
  });
});
