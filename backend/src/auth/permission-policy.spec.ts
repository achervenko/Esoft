import {
  getPermissionRoles,
  getUserPermissions,
  hasPermission,
} from './permission-policy';
import { USER_ROLES, getEffectiveUserRoles } from './role-module-policy';
import optionalModuleIds from '../../prisma/module-catalog.json';

describe('module-aware permissions', () => {
  const modules = optionalModuleIds;
  const combinations = Array.from({ length: 2 ** modules.length }, (_, mask) =>
    modules.filter((_, i) => mask & (1 << i)),
  );
  it.each(['admin', 'auditor'])(
    'filters every module combination for %s',
    (role) => {
      for (const active of combinations) {
        const permissions = getUserPermissions(role, active);
        for (const module of modules) {
          const declared = getUserPermissions(role).filter((p) =>
            p.startsWith(`${module}.`),
          );
          expect(permissions.filter((p) => p.startsWith(`${module}.`))).toEqual(
            active.includes(module) ? declared : [],
          );
        }
        expect(permissions).toContain('users.profile.read');
        if (role === 'admin')
          expect(permissions).toContain('dictionaries.manage');
      }
    },
  );
  it('removes disabled roles as well as module permissions', () => {
    expect(getUserPermissions('engineer,storekeeper', [])).toEqual([]);
    expect(getUserPermissions('engineer,storekeeper', ['warehouse'])).toEqual(
      getUserPermissions('storekeeper'),
    );
  });
});

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

it('keeps ordinary reservation management separate from override', () => {
  expect(hasPermission('storekeeper', 'warehouse.reservations.manage')).toBe(
    true,
  );
  expect(hasPermission('storekeeper', 'warehouse.reservations.override')).toBe(
    false,
  );
  expect(hasPermission('admin', 'warehouse.reservations.manage')).toBe(true);
  expect(hasPermission('admin', 'warehouse.reservations.override')).toBe(true);
});
