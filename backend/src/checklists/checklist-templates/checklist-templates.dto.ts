export type ChecklistTemplatesQueryDto = {
  isActive?: unknown;
  limit?: unknown;
  page?: unknown;
  search?: unknown;
  sortBy?: unknown;
  sortDirection?: unknown;
  state?: unknown;
};

type ChecklistTemplateFieldsDto = {
  description?: unknown;
  modules?: unknown;
  name?: unknown;
};

export type ChecklistTemplatePayloadDto = ChecklistTemplateFieldsDto;

export type ArchiveTemplateDto = {
  reason?: unknown;
  version?: unknown;
};
