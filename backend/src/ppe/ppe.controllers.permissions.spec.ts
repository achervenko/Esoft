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
import { hasPermission } from '../auth/permission-policy';
import { USER_ROLES, getEffectiveUserRoles } from '../auth/role-module-policy';

describe('PPE controllers through the global guard', () => {
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
  it.each([
    ...USER_ROLES,
    'unknown',
    'engineer,storekeeper',
    'ppe_specialist,accounting_specialist',
    'admin,operator',
  ])('checks every handler for %s', async (role) => {
    for (const operation of operations) {
      jest.clearAllMocks();
      const effectiveRole = getEffectiveUserRoles(role, http.modules).join(',');
      const allowed = hasPermission(effectiveRole, operation.permission);
      expect((await http.request(operation, role)).status).toBe(
        allowed ? (operation.method === 'POST' ? 201 : 200) : 403,
      );
      if (allowed)
        expect(
          http.services[operation.group][operation.action],
        ).toHaveBeenCalledTimes(1);
      else http.expectNoServiceCalls();
    }
  });
  it('rejects unauthenticated requests without service calls', async () => {
    for (const operation of operations)
      expect((await http.request(operation)).status).toBe(401);
    http.expectNoServiceCalls();
  });
  it('denies disabled PPE access even to admin', async () => {
    http.modules.splice(0, http.modules.length, 'equipment');
    for (const operation of operations)
      expect(
        (
          await http.request(
            operation,
            'ppe_specialist,accounting_specialist,engineer',
          )
        ).status,
      ).toBe(403);
    http.expectNoServiceCalls();
    for (const operation of operations)
      expect(
        (await http.request(operation, 'admin,ppe_specialist')).status,
      ).toBe(403);
    http.expectNoServiceCalls();
  });
});
