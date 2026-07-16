import { getChecklistTemplateState } from './checklist-templates.presenter';

describe('checklist template presenter', () => {
  it('maps draft state', () => {
    expect(getChecklistTemplateState({ isActive: false, isPublished: false })).toBe(
      'DRAFT',
    );
  });

  it('maps active published state', () => {
    expect(getChecklistTemplateState({ isActive: true, isPublished: true })).toBe(
      'ACTIVE',
    );
  });

  it('maps archived published state', () => {
    expect(getChecklistTemplateState({ isActive: false, isPublished: true })).toBe(
      'ARCHIVED',
    );
  });
});
