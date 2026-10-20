import {
  getPermissionRoles,
  getUserPermissions,
  hasPermission,
} from './permission-policy';
import { USER_ROLES, getEffectiveUserRoles } from './role-module-policy';

it('grants stock adjustments only through the admin role', () => {
  for (const role of USER_ROLES)
    expect(hasPermission(role, 'warehouse.adjustments.manage')).toBe(
      role === 'admin',
    );
});

describe('profile read permission', () => {
  it('is an ordinary permission granted by each known role', () => {
    expect(getPermissionRoles('users.profile.read')).toEqual([...USER_ROLES]);
    for (const role of USER_ROLES)
      expect(hasPermission(role, 'users.profile.read')).toBe(true);
  });
  it('is absent without effective roles and returns when a module is enabled', () => {
    const assignedRole = 'operator,storekeeper';
    expect(
      hasPermission(
        getEffectiveUserRoles(assignedRole, []).join(','),
        'users.profile.read',
      ),
    ).toBe(false);
    expect(
      hasPermission(
        getEffectiveUserRoles(assignedRole, ['equipment']).join(','),
        'users.profile.read',
      ),
    ).toBe(true);
    expect(
      hasPermission(
        getEffectiveUserRoles(assignedRole, ['warehouse']).join(','),
        'users.profile.read',
      ),
    ).toBe(true);
    expect(hasPermission('unknown', 'users.profile.read')).toBe(false);
  });
  it('unions profile access without duplicates or administrative privileges', () => {
    const permissions = getUserPermissions('operator,storekeeper');
    expect(
      permissions.filter((permission) => permission === 'users.profile.read'),
    ).toHaveLength(1);
    expect(permissions).not.toContain('users.manage');
  });
});
