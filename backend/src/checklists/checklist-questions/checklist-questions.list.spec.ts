import { ChecklistQuestionsService } from './checklist-questions.service';
import { parseChecklistQuestionsQuery } from './checklist-questions.validation';

describe('Checklist question list sorting', () => {
  it.each([
    {
      query: {},
      moduleId: undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    },
    {
      query: { checklistModuleId: '3' },
      moduleId: 3,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    },
    {
      query: { checklistModuleId: null },
      moduleId: null,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    },
    {
      query: { checklistModuleId: 'null' },
      moduleId: null,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    },
    {
      query: {
        checklistModuleId: 'null',
        sortBy: 'questionText',
        sortDirection: 'desc',
      },
      moduleId: null,
      orderBy: [{ questionText: 'desc' }, { id: 'desc' }],
    },
  ])(
    'passes parsed sorting to Prisma for $query',
    async ({ query, moduleId, orderBy }) => {
      const prisma = {
        checklistQuestion: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
        },
      };
      const service = new ChecklistQuestionsService(
        {} as never,
        {} as never,
        {} as never,
        prisma as never,
        {} as never,
        {} as never,
      );
      await service.list(parseChecklistQuestionsQuery(query));
      expect(prisma.checklistQuestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy,
          where: expect.objectContaining({
            checklistModuleId: moduleId,
          }) as unknown,
        }),
      );
    },
  );
});
