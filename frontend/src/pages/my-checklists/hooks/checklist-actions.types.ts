import type { ChecklistWorkDetail } from "../../../shared/api/checklists";

export type SaveChecklistResult =
  | {
      changed: boolean;
      checklist: ChecklistWorkDetail;
      success: true;
    }
  | {
      reason:
        | "missing_checklist"
        | "reload_failed"
        | "request"
        | "validation";
      success: false;
    };
