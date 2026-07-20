import {
  getChecklistTemplateState,
  presentTemplateMaintenanceSettingsUsage,
} from './checklist-templates.presenter';

describe('checklist template presenter', () => {
  it('maps active state', () => {
    expect(getChecklistTemplateState({ isActive: true })).toBe('ACTIVE');
  });

  it('maps archived state', () => {
    expect(getChecklistTemplateState({ isActive: false })).toBe('ARCHIVED');
  });

  it('presents maintenance settings usage', () => {
    expect(
      presentTemplateMaintenanceSettingsUsage([
        {
          equipmentModelId: 10,
          equipmentModelName: 'Станок',
          id: 1,
          maintenanceTypeCode: 'TO-1',
          maintenanceTypeId: 20,
          maintenanceTypeName: 'ТО-1',
        },
      ]),
    ).toEqual({
      maintenanceSettings: [
        {
          equipmentModel: {
            id: 10,
            name: 'Станок',
          },
          id: 1,
          maintenanceType: {
            code: 'TO-1',
            id: 20,
            name: 'ТО-1',
          },
        },
      ],
      maintenanceSettingsCount: 1,
    });
  });
});
