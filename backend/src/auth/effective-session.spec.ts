import optionalModuleIds from '../../prisma/module-catalog.json';
import { withEffectiveRoles } from './effective-session';
import { getUserPermissions } from './permission-policy';
describe('effective session permissions', () => {
  it('returns only permissions of active roles without mutating the stored user', () => {
    const value = {
      user: { id: 'u', role: 'engineer,storekeeper,accounting_specialist' },
      session: {},
    };
    const result = withEffectiveRoles(value, ['equipment']);
    expect(result.user.role).toBe('engineer');
    expect(result.user.assignedRole).toBe(value.user.role);
    expect(result.user.permissions).toEqual(getUserPermissions('engineer'));
    expect(result.user.permissions).not.toContain('warehouse.catalog.manage');
    expect(result.user.permissions).not.toContain('ppe.issue');
    expect(value.user).not.toHaveProperty('permissions');
  });
  it('unions active roles and returns no permissions if none remain', () => {
    const value = {
      user: { id: 'u', role: 'engineer,storekeeper' },
      session: {},
    };
    expect(
      withEffectiveRoles(value, ['equipment', 'warehouse']).user.permissions,
    ).toEqual(getUserPermissions(value.user.role));
    const inactive = withEffectiveRoles(value, []);
    expect(inactive.user.role).toBe('');
    expect(inactive.user.assignedRole).toBe('engineer,storekeeper');
    expect(inactive.user.permissions).toEqual([]);
  });
  it('replaces any stale permissions with the current policy', () => {
    const value = {
      user: { id: 'u', role: 'storekeeper', permissions: ['users.manage'] },
      session: {},
    };
    expect(withEffectiveRoles(value, ['warehouse']).user.permissions).toEqual(
      getUserPermissions('storekeeper'),
    );
  });
  it('hides warehouse UI permissions for admin when warehouse is disabled', () => {
    const value = { user: { id: 'admin', role: 'admin' }, session: {} };
    const disabled = withEffectiveRoles(value, ['equipment', 'ppe']).user
      .permissions;
    expect(disabled).toContain('dictionaries.manage');
    expect(disabled.some((p) => p.startsWith('warehouse.'))).toBe(false);
    expect(
      withEffectiveRoles(value, optionalModuleIds).user.permissions,
    ).toContain('warehouse.storage-locations.read');
  });
});
