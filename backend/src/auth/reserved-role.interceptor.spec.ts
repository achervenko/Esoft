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
  it.each(['/api/equipment', '/api/search', '/api/users/other/profile'])(
    'rejects %s',
    (path) => {
      expect(check('accounting_specialist', path)).toThrow(ForbiddenException);
    },
  );
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
