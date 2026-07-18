import type {
  ChecklistAnswerType,
  ChecklistWorkAnswerPayload,
  ChecklistWorkDetail,
  ChecklistWorkQuestion,
} from "../../shared/api/checklists";
import type { DraftAnswers } from "./my-checklists.types";

export function buildDraftAnswers(detail: ChecklistWorkDetail): DraftAnswers {
  const entries = detail.modules.flatMap((module) =>
    module.questions.map(
      (question) => [question.checklistDetailId, toDraftValue(question)] as const,
    ),
  );

  return Object.fromEntries(entries);
}

export function toDraftValue(question: ChecklistWorkQuestion) {
  switch (question.answerType) {
    case "BOOLEAN":
      return question.answer === null ? "" : question.answer ? "true" : "false";
    case "INTEGER":
    case "DECIMAL":
      return question.answer === null ? "" : String(question.answer);
    case "TEXT":
    case "DATE":
      return typeof question.answer === "string" ? question.answer : "";
  }
}

export function getChangedAnswers(
  detail: ChecklistWorkDetail,
  draftAnswers: DraftAnswers,
) {
  return detail.modules.flatMap((module) =>
    module.questions.flatMap((question) => {
      const currentDraftValue =
        draftAnswers[question.checklistDetailId] ?? toDraftValue(question);
      const originalValue = toDraftValue(question);

      if (currentDraftValue === originalValue) {
        return [];
      }

      return [
        {
          checklistDetailId: question.checklistDetailId,
          value: toApiAnswerValue(question.answerType, currentDraftValue),
        } satisfies ChecklistWorkAnswerPayload,
      ];
    }),
  );
}

export function toApiAnswerValue(answerType: ChecklistAnswerType, value: string) {
  const trimmedValue = value.trim();

  if (answerType === "BOOLEAN") {
    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }

    return null;
  }

  if (trimmedValue === "") {
    return null;
  }

  if (answerType === "INTEGER") {
    return Number(trimmedValue);
  }

  if (answerType === "DECIMAL") {
    return trimmedValue;
  }

  return trimmedValue;
}

export function validateRequiredAnswers(
  detail: ChecklistWorkDetail,
  draftAnswers: DraftAnswers,
) {
  for (const module of detail.modules) {
    for (const question of module.questions) {
      if (!question.isRequired) {
        continue;
      }

      const value =
        draftAnswers[question.checklistDetailId] ?? toDraftValue(question);

      if (!hasDraftValue(question.answerType, value)) {
        return "Заполните все обязательные вопросы перед завершением чек-листа.";
      }
    }
  }

  return null;
}

export function hasDraftValue(answerType: ChecklistAnswerType, value: string) {
  if (answerType === "BOOLEAN") {
    return value === "true" || value === "false";
  }

  return value.trim() !== "";
}

export function toQuestionAnswer(answerType: ChecklistAnswerType, value: string) {
  if (answerType === "BOOLEAN") {
    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }

    return null;
  }

  if (value.trim() === "") {
    return null;
  }

  if (answerType === "INTEGER") {
    return Number(value);
  }

  if (answerType === "DECIMAL") {
    return value;
  }

  return value;
}
