import { permissionsForTest } from "../../test/permission-fixtures";
import { expect, it } from 'vitest';
import { getUserRoles, hasRole } from './user-roles';
import { canAccessWorkspaceRoute, getDefaultAuthRoute } from '../../lib/role-navigation';
import { canManageEmployeeSizes, canManagePpeCatalog } from '../../modules/ppe-permissions/ppe-permissions';

it('normalizes a role set and ignores unknown values', () => {
  expect(getUserRoles(' engineer,storekeeper, engineer,unknown,,constructor')).toEqual(['engineer', 'storekeeper']);
  expect(hasRole('engineer, admin ', 'admin')).toBe(true);
  expect(hasRole('superadmin', 'admin')).toBe(false);
});
it('unions workspace and action permissions', () => {
  const role = 'engineer,storekeeper,accounting_specialist,ppe_specialist';
  expect(canAccessWorkspaceRoute(permissionsForTest(role), '#/equipment')).toBe(true);
  expect(canAccessWorkspaceRoute(permissionsForTest(role), '#/ppe')).toBe(true);
  expect(canManagePpeCatalog(permissionsForTest(role))).toBe(true);
  expect(canManageEmployeeSizes(permissionsForTest(role))).toBe(true);
  expect(canAccessWorkspaceRoute(permissionsForTest(role), '#/users')).toBe(false);
  expect(canAccessWorkspaceRoute(permissionsForTest('storekeeper,admin'), '#/users')).toBe(true);
});
it('chooses a reachable route for combined or fully inactive roles', () => {
  expect(getDefaultAuthRoute(permissionsForTest('engineer,storekeeper'))).toBe('#/dashboard');
  expect(getDefaultAuthRoute(permissionsForTest('storekeeper,accounting_specialist'))).toBe('#/ppe');
  expect(getDefaultAuthRoute(permissionsForTest('storekeeper'))).toBe('#/profile');
  expect(getDefaultAuthRoute(permissionsForTest(''))).toBe('#/profile');
});
