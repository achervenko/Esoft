import { ChecklistAnswerType } from '@prisma/client';
import type {
  ChecklistDetailQuestionRow,
  ChecklistDetailRow,
  ChecklistListRow,
} from './checklist-work.repository.types';

type ProgressLike = {
  answered: bigint;
  requiredAnswered: bigint;
  requiredTotal: bigint;
  total: bigint;
};

export function presentChecklistList(result: {
  rows: ChecklistListRow[];
  total: number;
}) {
  return {
    items: result.rows.map(presentChecklistListItem),
    total: result.total,
  };
}

export function presentChecklistDetail(
  checklist: ChecklistDetailRow,
  questions: ChecklistDetailQuestionRow[],
) {
  return {
    ...presentChecklistListItem(checklist),
    completedAt: checklist.completedAt?.toISOString() ?? null,
    modules: presentModules(questions),
    startedAt: checklist.startedAt?.toISOString() ?? null,
  };
}

export function presentChecklistProgress(
  checklistId: number,
  version: number,
  progress: ProgressLike,
) {
  return {
    id: checklistId,
    progress: presentProgress(progress),
    version,
  };
}

function presentChecklistListItem(row: ChecklistListRow) {
  return {
    id: row.id,
    status: row.status,
    sortOrder: row.sortOrder,
    version: row.version,
    assignedUser: {
      id: row.assignedUserId,
      fullName: row.assignedUserFullName,
      position: row.assignedUserPosition,
    },
    template: {
      id: row.checklistTemplateId,
      name: row.templateName,
    },
    event: {
      id: row.eventId,
      status: row.eventStatus,
      plannedDate: formatDate(row.eventPlannedDate),
      maintenanceType: {
        id: row.maintenanceTypeId,
        name: row.maintenanceTypeName,
      },
    },
    equipment: {
      visibleId: row.equipmentVisibleId,
      name: row.equipmentName,
      model: {
        name: row.equipmentModelName,
      },
    },
    progress: presentProgress(row),
  };
}

function presentModules(questions: ChecklistDetailQuestionRow[]) {
  const modules = new Map<
    number,
    {
      moduleKey: number;
      name: string;
      questions: ReturnType<typeof presentQuestion>[];
      sortOrder: number;
    }
  >();

  for (const question of questions) {
    const module = modules.get(question.moduleSortOrder) ?? {
      moduleKey: question.moduleSortOrder,
      name: question.moduleName,
      questions: [],
      sortOrder: question.moduleSortOrder,
    };

    module.questions.push(presentQuestion(question));
    modules.set(question.moduleSortOrder, module);
  }

  return [...modules.values()].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );
}

function presentQuestion(question: ChecklistDetailQuestionRow) {
  return {
    checklistDetailId: question.checklistDetailId,
    questionId: question.checklistQuestionId,
    text: question.questionText,
    answerType: question.answerType,
    isRequired: question.isRequired,
    sortOrder: question.questionSortOrder,
    answer: presentAnswer(question),
    answeredAt: question.answeredAt?.toISOString() ?? null,
  };
}

function presentAnswer(question: ChecklistDetailQuestionRow) {
  switch (question.answerType) {
    case ChecklistAnswerType.BOOLEAN:
      return question.answerBoolean;
    case ChecklistAnswerType.INTEGER:
      return question.answerInteger;
    case ChecklistAnswerType.DECIMAL:
      return question.answerDecimal === null
        ? null
        : String(question.answerDecimal);
    case ChecklistAnswerType.TEXT:
      return question.answerText;
    case ChecklistAnswerType.DATE:
      return formatDate(question.answerDate);
  }
}

function presentProgress(progress: ProgressLike) {
  return {
    answered: Number(progress.answered),
    total: Number(progress.total),
    requiredAnswered: Number(progress.requiredAnswered),
    requiredTotal: Number(progress.requiredTotal),
  };
}

function formatDate(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? null;
}
