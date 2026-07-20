import { ChecklistAnswerType } from '@prisma/client';
import { ChecklistTemplateAssertions } from './checklist-template.assertions';

describe('ChecklistTemplateAssertions', () => {
  const assertions = new ChecklistTemplateAssertions();

  it('rejects active questions from inactive modules', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          answerType: ChecklistAnswerType.BOOLEAN,
          checklistModuleId: 10,
          id: 20,
          isActive: true,
          moduleId: 10,
          moduleIsActive: false,
          moduleName: 'Визуальный осмотр',
          questionText: 'Есть внешние повреждения?',
          sortOrder: 1,
        },
      ]),
    };

    try {
      await assertions.loadActiveQuestion(tx as never, 20);
      fail('Expected loadActiveQuestion to reject inactive module');
    } catch (error) {
      const response = (error as { response?: { code?: string } }).response;

      expect(response?.code).toBe('CHECKLIST_MODULE_INACTIVE');
    }

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns active questions from active modules', async () => {
    const question = {
      answerType: ChecklistAnswerType.BOOLEAN,
      checklistModuleId: 10,
      id: 20,
      isActive: true,
      module: {
        id: 10,
        isActive: true,
        name: 'Визуальный осмотр',
      },
      questionText: 'Есть внешние повреждения?',
      sortOrder: 1,
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          answerType: question.answerType,
          checklistModuleId: question.checklistModuleId,
          id: question.id,
          isActive: question.isActive,
          moduleId: question.module.id,
          moduleIsActive: question.module.isActive,
          moduleName: question.module.name,
          questionText: question.questionText,
          sortOrder: question.sortOrder,
        },
      ]),
    };

    await expect(
      assertions.loadActiveQuestion(tx as never, 20),
    ).resolves.toEqual(question);
  });
});
