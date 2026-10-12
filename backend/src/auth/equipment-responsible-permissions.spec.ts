import { canReadEquipment, getEquipmentResponsibleRoles } from './role-permissions';

describe('equipment responsible permissions', () => {
  it('derives assignees from equipment access and excludes the administrator', () => {
    expect(canReadEquipment('admin')).toBe(true);
    expect(getEquipmentResponsibleRoles()).not.toContain('admin');
    for (const role of getEquipmentResponsibleRoles()) expect(canReadEquipment(role)).toBe(true);
  });
  it.each(['ppe_specialist', 'accounting_specialist', 'unknown', null])('does not grant equipment access to %s', role => {
    expect(canReadEquipment(role)).toBe(false);
    expect(getEquipmentResponsibleRoles()).not.toContain(role);
  });
});
