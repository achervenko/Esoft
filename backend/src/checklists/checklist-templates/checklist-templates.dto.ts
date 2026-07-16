export type ChecklistTemplatesQueryDto = {
  equipmentModelId?: unknown;
  isActive?: unknown;
  isPublished?: unknown;
  limit?: unknown;
  maintenanceTypeId?: unknown;
  page?: unknown;
  search?: unknown;
  sortBy?: unknown;
  sortDirection?: unknown;
  state?: unknown;
};

type ChecklistTemplateFieldsDto = {
  description?: unknown;
  equipmentModelId?: unknown;
  maintenanceTypeId?: unknown;
  name?: unknown;
};

export type ChecklistTemplatePayloadDto = ChecklistTemplateFieldsDto;

export type ChecklistTemplateUpdateDto = ChecklistTemplateFieldsDto & {
  version?: unknown;
};

export type AddTemplateModuleDto = {
  checklistModuleId?: unknown;
  version?: unknown;
};

export type AddTemplateQuestionDto = {
  checklistQuestionId?: unknown;
  isRequired?: unknown;
  version?: unknown;
};

export type UpdateTemplateQuestionDto = {
  isRequired?: unknown;
  version?: unknown;
};

export type ModuleOrderDto = {
  moduleIds?: unknown;
  version?: unknown;
};

export type QuestionOrderDto = {
  questionIds?: unknown;
  version?: unknown;
};

export type CopyTemplateDto = {
  name?: unknown;
};

export type ArchiveTemplateDto = {
  reason?: unknown;
  version?: unknown;
};

export type TemplateMutationVersionDto = {
  version?: unknown;
};
