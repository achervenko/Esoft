import { Prisma } from '@prisma/client';
import type {
  parseChecklistModulePayload,
  parseChecklistModuleReorderPayload,
  parseChecklistModuleUpdatePayload,
  parseChecklistModulesQuery,
} from './checklist-modules.validation';
import { checklistModuleSelect } from './checklist-modules.select';

export type ModuleInput = ReturnType<typeof parseChecklistModulePayload>;
export type ModuleUpdateInput = ReturnType<
  typeof parseChecklistModuleUpdatePayload
>;
export type ModuleQuery = ReturnType<typeof parseChecklistModulesQuery>;
export type ModuleReorderInput = ReturnType<
  typeof parseChecklistModuleReorderPayload
>;
export type ChecklistModuleView = Prisma.ChecklistModuleGetPayload<{
  select: typeof checklistModuleSelect;
}>;
