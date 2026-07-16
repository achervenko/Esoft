import { ChecklistStatus } from '@prisma/client';

export type ChecklistWorkQueryDto = {
  dateFrom?: unknown;
  dateTo?: unknown;
  equipmentVisibleId?: unknown;
  eventId?: unknown;
  limit?: unknown;
  offset?: unknown;
  status?: unknown;
};

export type ChecklistWorkQuery = {
  dateFrom?: Date;
  dateTo?: Date;
  equipmentVisibleId?: number;
  eventId?: number;
  limit: number;
  offset: number;
  statuses?: ChecklistStatus[];
};

export type ChecklistVersionDto = {
  version?: unknown;
};

export type ChecklistAnswerInputDto = {
  checklistDetailId?: unknown;
  value?: unknown;
};

export type ChecklistAnswersDto = {
  answers?: unknown;
  version?: unknown;
};

export type ChecklistAnswerValue =
  | { kind: 'clear' }
  | { kind: 'BOOLEAN'; value: boolean }
  | { kind: 'INTEGER'; value: number }
  | { kind: 'DECIMAL'; value: string }
  | { kind: 'TEXT'; value: string | null }
  | { kind: 'DATE'; value: string };

export type ChecklistAnswerInput = {
  checklistDetailId: number;
  value: unknown;
};

export type ParsedChecklistAnswer = {
  checklistDetailId: number;
  value: ChecklistAnswerValue;
};

export type ChecklistVersionInput = {
  version: number;
};

export type ChecklistAnswersInput = ChecklistVersionInput & {
  answers: ChecklistAnswerInput[];
};
