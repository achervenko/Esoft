export type StartEventDto = {
  version?: unknown;
};

export type CompleteEventDto = {
  factDate?: unknown;
  version?: unknown;
};

export type CancelEventDto = {
  version?: unknown;
};

export type CreateEventDto = {
  checklistAssignments?: unknown;
  equipmentId?: unknown;
  equipmentVisibleId?: unknown;
  extension?: unknown;
  extensionCode?: unknown;
  maintenanceTypeId?: unknown;
  note?: unknown;
  plannedDate?: unknown;
  responsibleUserIds?: unknown;
  title?: unknown;
};

export type EventsListQueryDto = {
  dateFrom?: unknown;
  dateTo?: unknown;
  equipmentVisibleId?: unknown;
  extensionCode?: unknown;
  limit?: unknown;
  maintenanceTypeId?: unknown;
  offset?: unknown;
  responsibleUserId?: unknown;
  source?: unknown;
  status?: unknown;
};

export type UpdateCreatedEventDto = {
  checklistAssignments?: unknown;
  equipmentId?: unknown;
  equipmentVisibleId?: unknown;
  extension?: unknown;
  extensionCode?: unknown;
  maintenanceTypeId?: unknown;
  note?: unknown;
  plannedDate?: unknown;
  responsibleUserIds?: unknown;
  title?: unknown;
  version?: unknown;
};
