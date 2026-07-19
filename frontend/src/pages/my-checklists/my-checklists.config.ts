import type { ChecklistWorkStatus } from "../../shared/api/checklists";

export type ChecklistTabKey = "new" | "in-progress" | "completed";

export const checklistTabOrder: ChecklistTabKey[] = [
  "new",
  "in-progress",
  "completed",
];

export const tabConfig: Record<
  ChecklistTabKey,
  { label: string; statuses: ChecklistWorkStatus[] }
> = {
  new: {
    label: "Новые",
    statuses: ["CREATED"],
  },
  "in-progress": {
    label: "В работе",
    statuses: ["IN_PROGRESS"],
  },
  completed: {
    label: "Завершённые",
    statuses: ["COMPLETED"],
  },
};

export const checklistStatusLabels: Record<ChecklistWorkStatus, string> = {
  CANCELLED: "Отменён",
  COMPLETED: "Завершён",
  CREATED: "Назначен",
  IN_PROGRESS: "В работе",
  INVALIDATED: "Недействителен",
};
