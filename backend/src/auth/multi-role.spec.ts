import { hasPermission } from './permission-policy';
import {
  getEffectiveUserRoles,
  getUserRoles,
  hasRole,
  parseUserRoles,
} from './role-module-policy';
import { canReadEquipment, canReadPpe } from './role-permissions';
import { withEffectiveRoles } from './effective-session';

describe('multi-role authorization', () => {
  it('normalizes known roles without granting unknown names', () => {
    expect(
      getUserRoles(' engineer, storekeeper,engineer,unknown,,constructor '),
    ).toEqual(['engineer', 'storekeeper']);
    expect(hasRole('auditor, admin ', 'admin')).toBe(true);
    expect(hasRole('superadmin', 'admin')).toBe(false);
    expect(getUserRoles(['admin'])).toEqual([]);
  });
  it.each([
    'admin,unknown',
    'admin,',
    '',
    ',engineer',
    null,
    [],
    ['admin', ''],
  ])('rejects malformed assignment %p', (value) => {
    expect(() => parseUserRoles(value)).toThrow();
  });
  it('normalizes an assignment as a set with a stable order', () => {
    expect(parseUserRoles([' storekeeper ', 'engineer', 'engineer'])).toEqual([
      'engineer',
      'storekeeper',
    ]);
  });
  it.each([
    {
      modules: ['equipment', 'warehouse'],
      expected: ['engineer', 'storekeeper'],
    },
    { modules: ['equipment'], expected: ['engineer'] },
    { modules: ['warehouse'], expected: ['storekeeper'] },
    { modules: [], expected: [] },
  ])('retains only effective roles for $modules', ({ modules, expected }) => {
    expect(getEffectiveUserRoles('engineer,storekeeper', modules)).toEqual(
      expected,
    );
  });
  it('unions permissions across all roles', () => {
    const role = 'storekeeper,engineer,accounting_specialist,ppe_specialist';
    expect(canReadEquipment(role)).toBe(true);
    expect(hasPermission(role, 'warehouse.catalog.manage')).toBe(true);
    expect(hasPermission(role, 'ppe.catalog.manage')).toBe(true);
    expect(hasPermission(role, 'ppe.employee-sizes.manage')).toBe(true);
    expect(hasPermission(role, 'users.manage')).toBe(false);
    expect(hasPermission(role, 'checklists.manage')).toBe(false);
    expect(hasPermission('engineer,admin', 'users.manage')).toBe(true);
  });
  it('does not leak disabled permissions or mutate the assigned role', () => {
    const original = {
      user: { id: 'u', role: 'engineer,storekeeper,ppe_specialist' },
      session: { id: 's' },
    };
    const effective = withEffectiveRoles(original, ['equipment']);
    expect(effective.user.role).toBe('engineer');
    expect(effective.user.assignedRole).toBe(original.user.role);
    expect(original.user.role).toBe('engineer,storekeeper,ppe_specialist');
    expect(canReadEquipment(effective.user.role)).toBe(true);
    expect(hasPermission(effective.user.role, 'warehouse.catalog.manage')).toBe(
      false,
    );
    expect(canReadPpe(effective.user.role)).toBe(false);
  });
});
