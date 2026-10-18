import { createAuthMiddleware } from 'better-auth/api';
import { parseUserRoles, validateRoleTransition } from './role-module-policy';
import { rethrowRoleApiError } from './role-api-error';

export function createRoleAvailabilityHooks(activeModules: readonly string[]) {
  return {
    user: {
      create: {
        before: (user: { role?: unknown } & Record<string, unknown>) => {
          try {
            const { value } = validateRoleTransition({
              currentRole: null,
              requestedRole: user.role === undefined ? 'operator' : user.role,
              activeModules,
            });
            return Promise.resolve({ data: { ...user, role: value } });
          } catch (error) {
            rethrowRoleApiError(error);
          }
        },
      },
      update: {
        before: (data: { role?: unknown } & Record<string, unknown>) => {
          try {
            // The role-aware adapter reads the persisted assignment and validates
            // this transition while holding the row lock through the write.
            return Promise.resolve({
              data: Object.prototype.hasOwnProperty.call(data, 'role')
                ? { ...data, role: parseUserRoles(data.role).join(',') }
                : data,
            });
          } catch (error) {
            rethrowRoleApiError(error);
          }
        },
      },
    },
  };
}

// Better Auth's admin plugin validates each role against its registry before
// database hooks. Normalize its accepted string/array forms before that step.
export function createRoleRequestHook() {
  return createAuthMiddleware((context) => {
    const body = context.body as Record<string, unknown> | undefined;
    if (!body) return Promise.resolve();
    const data =
      body.data && typeof body.data === 'object' && !Array.isArray(body.data)
        ? (body.data as Record<string, unknown>)
        : undefined;
    try {
      if (context.path === '/admin/set-role') {
        body.role = parseUserRoles(body.role);
        return Promise.resolve();
      }
      if (context.path === '/admin/create-user') {
        const role = body.role === undefined ? data?.role : body.role;
        if (role !== undefined) body.role = parseUserRoles(role);
      }
      if (
        context.path === '/admin/update-user' &&
        data &&
        Object.prototype.hasOwnProperty.call(data, 'role')
      ) {
        data.role = parseUserRoles(data.role);
      }
      return Promise.resolve();
    } catch (error) {
      rethrowRoleApiError(error);
    }
  });
}
