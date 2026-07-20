import type { Prisma } from '@prisma/client';
import type { parseArchiveTemplateDto } from './checklist-template-lifecycle.validation';
import type { parseChecklistTemplatePayload } from './checklist-template.validation';
import type { parseChecklistTemplatesQuery } from './checklist-templates-query.validation';

export type TemplateQuery = ReturnType<typeof parseChecklistTemplatesQuery>;
export type TemplateInput = ReturnType<typeof parseChecklistTemplatePayload>;
export type ArchiveInput = ReturnType<typeof parseArchiveTemplateDto>;

export type TemplateMaintenanceSettingUsage = {
  equipmentModelId: number;
  equipmentModelName: string;
  id: number;
  maintenanceTypeCode: string;
  maintenanceTypeId: number;
  maintenanceTypeName: string;
};

export const templateDetailInclude = {
  modules: {
    include: {
      questions: true,
    },
  },
} as const;

export const templateListInclude = {
  modules: {
    include: {
      _count: { select: { questions: true } },
    },
  },
} as const;
