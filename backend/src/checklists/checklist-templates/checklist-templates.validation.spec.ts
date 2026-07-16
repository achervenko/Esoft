import { BadRequestException } from '@nestjs/common';
import {
  parseAddTemplateQuestionDto,
  parseModuleOrderDto,
} from './checklist-template-structure.validation';
import {
  parseChecklistTemplatePayload,
  parseChecklistTemplateUpdatePayload,
} from './checklist-template.validation';

describe('checklist template validation', () => {
  it('rejects blank template name', () => {
    expectBadRequestCode(() =>
      parseChecklistTemplatePayload({
        equipmentModelId: 1,
        maintenanceTypeId: 1,
        name: '   ',
      }),
    ).toBe('CHECKLIST_TEMPLATE_NAME_REQUIRED');
  });

  it('rejects duplicate module ids in order payload', () => {
    expectBadRequestCode(() =>
      parseModuleOrderDto({ moduleIds: [1, 2, 2], version: 1 }),
    ).toBe('CHECKLIST_TEMPLATE_ORDER_INVALID');
  });

  it('defaults template question isRequired to true', () => {
    expect(
      parseAddTemplateQuestionDto({ checklistQuestionId: 10, version: 3 }),
    ).toMatchObject({
      checklistQuestionId: 10,
      isRequired: true,
      version: 3,
    });
  });

  it('allows partial update payloads', () => {
    expect(
      parseChecklistTemplateUpdatePayload({
        description: 'Новое описание',
        version: 3,
      }),
    ).toEqual({
      description: 'Новое описание',
      version: 3,
    });
  });

  it('rejects empty update payloads', () => {
    expectBadRequestCode(() =>
      parseChecklistTemplateUpdatePayload({ version: 3 }),
    ).toBe('CHECKLIST_TEMPLATE_UPDATE_EMPTY');
  });

  it('rejects state fields in update payloads', () => {
    const runtimePayload = {
      isActive: true,
      name: 'Шаблон ТО',
      version: 3,
    };

    expectBadRequestCode(() =>
      parseChecklistTemplateUpdatePayload(runtimePayload),
    ).toBe('CHECKLIST_TEMPLATE_FIELD_FORBIDDEN');
  });
});

function expectBadRequestCode(action: () => unknown) {
  try {
    action();
  } catch (error) {
    if (error instanceof BadRequestException) {
      const response = error.getResponse();

      if (
        response &&
        typeof response === 'object' &&
        'code' in response &&
        typeof response.code === 'string'
      ) {
        return expect(response.code);
      }
    }

    throw error;
  }

  throw new Error('Expected BadRequestException to be thrown.');
}
