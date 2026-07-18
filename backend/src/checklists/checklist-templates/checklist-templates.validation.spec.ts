import { BadRequestException } from '@nestjs/common';
import { parseChecklistTemplatesQuery } from './checklist-templates-query.validation';
import { parseChecklistTemplatePayload } from './checklist-template.validation';

describe('checklist template validation', () => {
  it('rejects blank template name', () => {
    expectBadRequestCode(() =>
      parseChecklistTemplatePayload({
        modules: [
          {
            checklistModuleId: 1,
            questions: [{ checklistQuestionId: 10 }],
          },
        ],
        name: '   ',
      }),
    ).toBe('CHECKLIST_TEMPLATE_NAME_REQUIRED');
  });

  it('accepts full template create payloads', () => {
    expect(
      parseChecklistTemplatePayload({
        description: 'Проверка',
        modules: [
          {
            checklistModuleId: 1,
            questions: [
              { checklistQuestionId: 10, isRequired: false, sortOrder: 1 },
              { checklistQuestionId: 11 },
            ],
            sortOrder: 1,
          },
        ],
        name: 'Диагностика',
      }),
    ).toEqual({
      description: 'Проверка',
      modules: [
        {
          checklistModuleId: 1,
          questions: [
            { checklistQuestionId: 10, isRequired: false, sortOrder: 1 },
            { checklistQuestionId: 11, isRequired: true, sortOrder: 2 },
          ],
          sortOrder: 1,
        },
      ],
      name: 'Диагностика',
    });
  });

  it('rejects duplicate module ids in create payloads', () => {
    expectBadRequestCode(() =>
      parseChecklistTemplatePayload({
        modules: [
          {
            checklistModuleId: 1,
            questions: [{ checklistQuestionId: 10 }],
          },
          {
            checklistModuleId: 1,
            questions: [{ checklistQuestionId: 11 }],
          },
        ],
        name: 'Диагностика',
      }),
    ).toBe('CHECKLIST_TEMPLATE_MODULE_DUPLICATE');
  });

  it('rejects duplicate question ids in create payloads', () => {
    expectBadRequestCode(() =>
      parseChecklistTemplatePayload({
        modules: [
          {
            checklistModuleId: 1,
            questions: [
              { checklistQuestionId: 10 },
              { checklistQuestionId: 10 },
            ],
          },
        ],
        name: 'Диагностика',
      }),
    ).toBe('CHECKLIST_TEMPLATE_QUESTION_DUPLICATE');
  });

  it('rejects non-sequential module order in create payloads', () => {
    expectBadRequestCode(() =>
      parseChecklistTemplatePayload({
        modules: [
          {
            checklistModuleId: 1,
            questions: [{ checklistQuestionId: 10 }],
            sortOrder: 1,
          },
          {
            checklistModuleId: 2,
            questions: [{ checklistQuestionId: 11 }],
            sortOrder: 3,
          },
        ],
        name: 'Диагностика',
      }),
    ).toBe('CHECKLIST_TEMPLATE_ORDER_INVALID');
  });

  it('rejects non-sequential question order in create payloads', () => {
    expectBadRequestCode(() =>
      parseChecklistTemplatePayload({
        modules: [
          {
            checklistModuleId: 1,
            questions: [
              { checklistQuestionId: 10, sortOrder: 1 },
              { checklistQuestionId: 11, sortOrder: 3 },
            ],
          },
        ],
        name: 'Диагностика',
      }),
    ).toBe('CHECKLIST_TEMPLATE_ORDER_INVALID');
  });

  it('rejects empty module questions in create payloads', () => {
    expectBadRequestCode(() =>
      parseChecklistTemplatePayload({
        modules: [
          {
            checklistModuleId: 1,
            questions: [],
          },
        ],
        name: 'Диагностика',
      }),
    ).toBe('CHECKLIST_TEMPLATE_MODULE_EMPTY');
  });

  it('rejects legacy model and maintenance type fields in create payloads', () => {
    expectBadRequestCode(() =>
      parseChecklistTemplatePayload({
        equipmentModelId: 1,
        maintenanceTypeId: 1,
        modules: [
          {
            checklistModuleId: 1,
            questions: [{ checklistQuestionId: 10 }],
          },
        ],
        name: 'Шаблон ТО',
      }),
    ).toBe('CHECKLIST_TEMPLATE_FIELD_FORBIDDEN');
  });

  it('rejects conflicting template state query filters', () => {
    expectBadRequestCode(() =>
      parseChecklistTemplatesQuery({
        isActive: true,
        state: 'ACTIVE',
      }),
    ).toBe('CHECKLIST_TEMPLATE_STATE_FILTER_CONFLICT');
  });

  it('rejects technical published query filter', () => {
    expectBadRequestCode(() =>
      parseChecklistTemplatesQuery({
        isPublished: true,
      } as never),
    ).toBe('CHECKLIST_TEMPLATE_PUBLISHED_FILTER_FORBIDDEN');
  });

  it('rejects technical draft state query filter', () => {
    expectBadRequestCode(() =>
      parseChecklistTemplatesQuery({
        state: 'DRAFT',
      }),
    ).toBe('CHECKLIST_TEMPLATE_STATE_INVALID');
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
