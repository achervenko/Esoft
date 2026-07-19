import type {
  ChecklistAnswerType,
  ChecklistWorkAnswerPayload,
  ChecklistWorkDetail,
  ChecklistWorkQuestion,
} from "../../shared/api/checklists";
import type { DraftAnswers } from "./my-checklists.types";

export function formatRuDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  const parts = [
    digits.slice(0, 2),
    digits.slice(2, 4),
    digits.slice(4, 8),
  ].filter(Boolean);

  return parts.join(".");
}

export function parseRuDateInput(value: string) {
  const match = value.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

function toRuDateDraftValue(value: string) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "UTC",
  }).format(parsedDate);
}

function toBooleanAnswerValue(value: string) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

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
      return typeof question.answer === "string" ? question.answer : "";
    case "DATE":
      return typeof question.answer === "string"
        ? toRuDateDraftValue(question.answer)
        : "";
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
    return toBooleanAnswerValue(value);
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

  if (answerType === "DATE") {
    return parseRuDateInput(trimmedValue) ?? trimmedValue;
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

export function validateDraftAnswers(
  detail: ChecklistWorkDetail,
  draftAnswers: DraftAnswers,
) {
  for (const module of detail.modules) {
    for (const question of module.questions) {
      if (question.answerType !== "DATE") {
        continue;
      }

      const value =
        draftAnswers[question.checklistDetailId] ?? toDraftValue(question);
      const trimmedValue = value.trim();

      if (trimmedValue === "") {
        continue;
      }

      if (!parseRuDateInput(trimmedValue)) {
        return "Введите корректную дату в формате ДД.ММ.ГГГГ.";
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
