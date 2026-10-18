import { USER_ROLES } from './role-module-policy';
import { hasPermission } from './permission-policy';
import {
  canReadEquipment,
  getEquipmentResponsibleRoles,
} from './role-permissions';

describe('equipment responsible permissions', () => {
  it('derives assignees from equipment access and excludes the administrator', () => {
    expect(canReadEquipment('admin')).toBe(true);
    const expected = USER_ROLES.filter(
      (role) => role !== 'admin' && hasPermission(role, 'equipment.read'),
    );
    expect(getEquipmentResponsibleRoles(['equipment'])).toEqual(expected);
  });
  it.each([
    ...USER_ROLES.filter((role) => !hasPermission(role, 'equipment.read')),
    'unknown',
    null,
  ])('does not grant equipment access to %s', (role) => {
    expect(canReadEquipment(role)).toBe(false);
    expect(getEquipmentResponsibleRoles(['equipment'])).not.toContain(role);
  });
  it('returns no equipment assignees when equipment is disabled', () => {
    expect(getEquipmentResponsibleRoles(['ppe', 'warehouse'])).toEqual([]);
    expect(getEquipmentResponsibleRoles([])).toEqual([]);
  });
});
