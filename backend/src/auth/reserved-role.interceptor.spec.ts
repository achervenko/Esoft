import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ReservedRoleInterceptor } from './reserved-role.interceptor';

describe('reserved accounting specialist role', () => {
  const interceptor = new ReservedRoleInterceptor();
  const check = (role: string, path: string, method = 'GET') => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          path,
          session: { user: { id: 'user-1', role } },
        }),
      }),
    } as unknown as ExecutionContext;
    const next = { handle: jest.fn() };
    return () => interceptor.intercept(context, next);
  };
  it.each([
    'admin',
    'chief_engineer',
    'engineer',
    'operator',
    'auditor',
    'ppe_specialist',
    'accounting_specialist',
    '',
  ])('allows startup status for role %s', (role) => {
    expect(check(role, '/api/setup/status')).not.toThrow();
  });
  it.each(['/api/equipment', '/api/users/other/profile'])(
    'rejects %s',
    (path) => {
      expect(check('accounting_specialist', path)).toThrow(ForbiddenException);
    },
  );
  it('allows the startup status check without granting setup management', () => {
    expect(check('accounting_specialist', '/api/setup/status')).not.toThrow();
    expect(check('accounting_specialist', '/api/search')).not.toThrow();
    expect(check('accounting_specialist', '/api/search', 'POST')).toThrow(
      ForbiddenException,
    );
    expect(check('accounting_specialist', '/api/setup/status', 'POST')).toThrow(
      ForbiddenException,
    );
    expect(check('accounting_specialist', '/api/setup/admin', 'POST')).toThrow(
      ForbiddenException,
    );
    expect(check('accounting_specialist', '/api/setup/employees')).toThrow(
      ForbiddenException,
    );
  });
  it('allows own profile only and does not restrict other roles', () => {
    expect(check('accounting_specialist', '/api/ppe/items')).not.toThrow();
    expect(
      check('accounting_specialist', '/api/users/user-1/profile'),
    ).not.toThrow();
    expect(
      check('accounting_specialist', '/api/users/user-1/profile', 'PUT'),
    ).toThrow();
    expect(check('admin', '/api/ppe/items', 'POST')).not.toThrow();
  });
});
