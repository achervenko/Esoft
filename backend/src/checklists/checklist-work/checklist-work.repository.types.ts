import {
  ChecklistAnswerType,
  ChecklistStatus,
  EquipmentEventStatus,
  Prisma,
} from '@prisma/client';

export type LockedChecklistEvent = {
  eventId: number;
  eventStatus: EquipmentEventStatus;
};

export type LockedChecklist = {
  assignedUserId: string;
  equipmentEventId: number;
  id: number;
  isRequired: boolean;
  status: ChecklistStatus;
  version: number;
};

export type ChecklistListRow = {
  answered: bigint;
  checklistTemplateId: number;
  equipmentModelName: string;
  equipmentName: string;
  equipmentVisibleId: number;
  eventId: number;
  eventPlannedDate: Date | null;
  eventStatus: EquipmentEventStatus;
  id: number;
  isRequired: boolean;
  maintenanceTypeId: number;
  maintenanceTypeName: string;
  requiredAnswered: bigint;
  requiredTotal: bigint;
  sortOrder: number;
  status: ChecklistStatus;
  templateName: string;
  total: bigint;
};

export type ChecklistDetailRow = ChecklistListRow & {
  completedAt: Date | null;
  startedAt: Date | null;
  version: number;
};

export type ChecklistDetailQuestionRow = {
  answerBoolean: boolean | null;
  answerDate: Date | null;
  answerDecimal: Prisma.Decimal | string | null;
  answerInteger: number | null;
  answerText: string | null;
  answerType: ChecklistAnswerType;
  answeredAt: Date | null;
  checklistDetailId: number;
  checklistQuestionId: number | null;
  isRequired: boolean;
  moduleName: string;
  moduleSortOrder: number;
  questionSortOrder: number;
  questionText: string;
};

export type ChecklistDetailAnswerRow = {
  answerBoolean: boolean | null;
  answerDate: Date | null;
  answerDecimal: Prisma.Decimal | string | null;
  answerInteger: number | null;
  answerText: string | null;
  answerType: ChecklistAnswerType;
  checklistDetailId: number;
  checklistId: number;
  isRequired: boolean;
};
