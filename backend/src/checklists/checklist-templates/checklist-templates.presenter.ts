import type { ChecklistTemplate, Prisma } from '@prisma/client';

export function getChecklistTemplateState(
  template: Pick<ChecklistTemplate, 'isActive'>,
) {
  return template.isActive ? 'ACTIVE' : 'ARCHIVED';
}

export function presentTemplateListItem(
  template: Prisma.ChecklistTemplateGetPayload<{
    include: {
      modules: { include: { _count: { select: { questions: true } } } };
    };
  }>,
) {
  return {
    archivedAt: template.archivedAt,
    createdAt: template.createdAt,
    id: template.id,
    moduleCount: template.modules.length,
    name: template.name,
    publishedAt: template.publishedAt,
    questionCount: template.modules.reduce(
      (sum, module) => sum + module._count.questions,
      0,
    ),
    state: getChecklistTemplateState(template),
    updatedAt: template.updatedAt,
    version: template.version,
  };
}

export function presentTemplateDetail(
  template: Prisma.ChecklistTemplateGetPayload<{
    include: {
      modules: {
        include: {
          questions: true;
        };
      };
    };
  }>,
) {
  return {
    archivedAt: template.archivedAt,
    basedOnTemplateId: template.basedOnTemplateId,
    createdAt: template.createdAt,
    description: template.description,
    id: template.id,
    modules: template.modules
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((module) => ({
        checklistModuleId: module.checklistModuleId,
        id: module.id,
        name: module.moduleNameSnapshot,
        questions: module.questions
          .slice()
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .map((question) => ({
            answerType: question.answerTypeSnapshot,
            checklistQuestionId: question.checklistQuestionId,
            id: question.id,
            isRequired: question.isRequired,
            questionText: question.questionTextSnapshot,
            sortOrder: question.sortOrder,
          })),
        sortOrder: module.sortOrder,
      })),
    name: template.name,
    publishedAt: template.publishedAt,
    state: getChecklistTemplateState(template),
    updatedAt: template.updatedAt,
    version: template.version,
  };
}
