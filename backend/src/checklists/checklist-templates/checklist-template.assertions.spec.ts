import { ChecklistAnswerType } from '@prisma/client';
import { ChecklistTemplateAssertions } from './checklist-template.assertions';

describe('ChecklistTemplateAssertions', () => {
  const assertions = new ChecklistTemplateAssertions();

  it('rejects active questions from inactive modules', async () => {
    const tx = {
      checklistQuestion: {
        findUnique: jest.fn().mockResolvedValue({
          answerType: ChecklistAnswerType.BOOLEAN,
          checklistModuleId: 10,
          id: 20,
          isActive: true,
          module: {
            id: 10,
            isActive: false,
            name: 'Визуальный осмотр',
          },
          questionText: 'Есть внешние повреждения?',
        }),
      },
    };

    await expect(
      assertions.loadActiveQuestion(tx as never, 20),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'CHECKLIST_MODULE_INACTIVE',
      }),
    });
    expect(tx.checklistQuestion.findUnique).toHaveBeenCalledWith({
      include: { module: true },
      where: { id: 20 },
    });
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
    };
    const tx = {
      checklistQuestion: {
        findUnique: jest.fn().mockResolvedValue(question),
      },
    };

    await expect(assertions.loadActiveQuestion(tx as never, 20)).resolves.toBe(
      question,
    );
  });
});
