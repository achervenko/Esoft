import type { ChecklistTemplate, Prisma } from '@prisma/client';

export function getChecklistTemplateState(
  template: Pick<ChecklistTemplate, 'isActive' | 'isPublished'>,
) {
  if (!template.isPublished) {
    return 'DRAFT';
  }

  return template.isActive ? 'ACTIVE' : 'ARCHIVED';
}

export function presentTemplateListItem(
  template: Prisma.ChecklistTemplateGetPayload<{
    include: {
      equipmentModel: { include: { manufacturer: true } };
      maintenanceType: true;
      modules: { include: { _count: { select: { questions: true } } } };
    };
  }>,
) {
  return {
    archivedAt: template.archivedAt,
    createdAt: template.createdAt,
    equipmentModel: presentEquipmentModel(template.equipmentModel),
    id: template.id,
    maintenanceType: presentMaintenanceType(template.maintenanceType),
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
      equipmentModel: { include: { manufacturer: true } };
      maintenanceType: true;
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
    equipmentModel: presentEquipmentModel(template.equipmentModel),
    id: template.id,
    maintenanceType: presentMaintenanceType(template.maintenanceType),
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

function presentEquipmentModel(
  model: Prisma.EquipmentModelGetPayload<{ include: { manufacturer: true } }>,
) {
  return {
    id: model.id,
    manufacturer: {
      id: model.manufacturer.id,
      name: model.manufacturer.name,
    },
    name: model.name,
  };
}

function presentMaintenanceType(type: { code: string; id: number; name: string }) {
  return {
    code: type.code,
    id: type.id,
    name: type.name,
  };
}
