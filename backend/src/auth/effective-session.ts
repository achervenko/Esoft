import { getUserPermissions } from './permission-policy';
import { getEffectiveUserRoles } from './role-module-policy';

export function withEffectiveRoles<
  T extends { user: { id: string; role?: unknown }; session: unknown },
>(value: T, activeModules: readonly string[]) {
  const role = getEffectiveUserRoles(value.user.role, activeModules).join(',');
  return {
    ...value,
    user: {
      ...value.user,
      assignedRole: value.user.role,
      role,
      permissions: getUserPermissions(role, activeModules),
    },
  };
}
