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
  [key: string]: unknown;
  checklistAssignments?: unknown;
  extension?: unknown;
  extensionCode?: unknown;
  note?: unknown;
  plannedDate?: unknown;
  responsibleUserIds?: unknown;
  title?: unknown;
};

export type EventsListQueryDto = {
  [key: string]: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
  extensionCode?: unknown;
  limit?: unknown;
  offset?: unknown;
  responsibleUserId?: unknown;
  source?: unknown;
  status?: unknown;
};

export type UpdateCreatedEventDto = {
  [key: string]: unknown;
  checklistAssignments?: unknown;
  extension?: unknown;
  extensionCode?: unknown;
  note?: unknown;
  plannedDate?: unknown;
  responsibleUserIds?: unknown;
  title?: unknown;
  version?: unknown;
};
