import { getChecklistTemplateState } from './checklist-templates.presenter';

describe('checklist template presenter', () => {
  it('maps active state', () => {
    expect(getChecklistTemplateState({ isActive: true })).toBe('ACTIVE');
  });

  it('maps archived state', () => {
    expect(getChecklistTemplateState({ isActive: false })).toBe('ARCHIVED');
  });
});
