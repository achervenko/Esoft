import { getHashRouteParam } from "../../shared/lib/hash-navigation";
import type { ChecklistProgressLike } from "./my-checklists.types";
import type { ChecklistTabKey } from "./my-checklists.config";

export function getActiveTab(route: string): ChecklistTabKey {
  const tab = getHashRouteParam(route, "tab");

  if (tab === "in-progress" || tab === "completed") {
    return tab;
  }

  return "new";
}

export function formatDate(value: string | null) {
  if (!value) {
    return "Не указана";
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "Не указано";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function formatProgress(progress: ChecklistProgressLike) {
  return `${progress.answered} из ${progress.total}`;
}
