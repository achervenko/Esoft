import { ConfirmDialog } from "../../shared/ui/ConfirmDialog";
import type { ChecklistAdminConfirmState } from "./checklist-admin.types";
import {
  getConfirmDescription,
  getConfirmLabel,
  getConfirmTitle,
} from "./checklist-admin.utils";

type ChecklistAdminConfirmDialogProps = {
  confirm: NonNullable<ChecklistAdminConfirmState>;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ChecklistAdminConfirmDialog({
  confirm,
  isSaving,
  onCancel,
  onConfirm,
}: ChecklistAdminConfirmDialogProps) {
  return (
    <ConfirmDialog
      cancelLabel="Отмена"
      confirmLabel={getConfirmLabel(confirm)}
      description={getConfirmDescription(confirm)}
      isLoading={isSaving}
      loadingLabel="Выполняется..."
      onCancel={onCancel}
      onConfirm={onConfirm}
      title={getConfirmTitle(confirm)}
      variant={confirm.kind === "archive-template" ? "danger" : "default"}
    />
  );
}
