import type {
  ChecklistModule,
  ChecklistQuestion,
  ChecklistTemplateListItem,
} from "../../shared/api/checklists";

export type ActiveChecklistAdminTab = "catalog" | "templates";

export type ChecklistAdminFormState =
  | { kind: "module"; item: ChecklistModule | null }
  | {
      defaultModuleId: number | null;
      kind: "question";
      item: ChecklistQuestion | null;
    }
  | null;

export type ChecklistAdminConfirmState =
  | { kind: "archive-template"; template: ChecklistTemplateListItem }
  | { kind: "module-status"; module: ChecklistModule }
  | { kind: "question-status"; question: ChecklistQuestion }
  | null;
