import type { Prisma } from '@prisma/client';
import type {
  parseAddTemplateModuleDto,
  parseAddTemplateQuestionDto,
  parseModuleOrderDto,
  parseQuestionOrderDto,
  parseUpdateTemplateQuestionDto,
} from './checklist-template-structure.validation';
import type {
  parseArchiveTemplateDto,
  parseCopyTemplateDto,
  parseTemplateMutationVersionDto,
} from './checklist-template-lifecycle.validation';
import type {
  parseChecklistTemplatePayload,
  parseChecklistTemplateUpdatePayload,
} from './checklist-template.validation';
import type { parseChecklistTemplatesQuery } from './checklist-templates-query.validation';

export type TemplateQuery = ReturnType<typeof parseChecklistTemplatesQuery>;
export type TemplateInput = ReturnType<typeof parseChecklistTemplatePayload>;
export type TemplateUpdateInput = ReturnType<
  typeof parseChecklistTemplateUpdatePayload
>;
export type TemplateMutationVersionInput = ReturnType<
  typeof parseTemplateMutationVersionDto
>;
export type AddModuleInput = ReturnType<typeof parseAddTemplateModuleDto>;
export type AddQuestionInput = ReturnType<typeof parseAddTemplateQuestionDto>;
export type UpdateQuestionInput = ReturnType<typeof parseUpdateTemplateQuestionDto>;
export type ModuleOrderInput = ReturnType<typeof parseModuleOrderDto>;
export type QuestionOrderInput = ReturnType<typeof parseQuestionOrderDto>;
export type CopyInput = ReturnType<typeof parseCopyTemplateDto>;
export type ArchiveInput = ReturnType<typeof parseArchiveTemplateDto>;

export const templateDetailInclude = {
  equipmentModel: { include: { manufacturer: true } },
  maintenanceType: true,
  modules: {
    include: {
      questions: true,
    },
  },
} as const;

export const templateListInclude = {
  equipmentModel: { include: { manufacturer: true } },
  maintenanceType: true,
  modules: {
    include: {
      _count: { select: { questions: true } },
    },
  },
} as const;

export type TemplateDetailRecord = Prisma.ChecklistTemplateGetPayload<{
  include: typeof templateDetailInclude;
}>;
