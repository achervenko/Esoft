import { useState } from "react";
import type {
  Receipt,
  ReceiptLine,
} from "../../shared/api/warehouse-receipts-api";
import { AdminModal } from "../../shared/ui/AdminModal";
import { ReceiptPlaceForm } from "./ReceiptPlaceForm";
import { ReceiptItemMapForm } from "./ReceiptItemMapForm";
import { ReceiptConflictResolveForm } from "./ReceiptConflictResolveForm";
import { ReceiptCancelForm } from "./ReceiptCancelForm";
export type ReceiptAction =
  | { kind: "place" | "item"; line: ReceiptLine }
  | { kind: "resolve" | "cancel" };
const titles = {
  place: "Разместить товар",
  item: "Сопоставить номенклатуру",
  resolve: "Решить конфликт",
  cancel: "Отменить приход",
};
export function ReceiptActionDialog({
  actorId,
  receipt,
  action,
  onClose,
  onSaved,
  canReconcileStock = false,
}: {
  actorId: string | null;
  canReconcileStock?: boolean;
  receipt: Receipt;
  action: ReceiptAction;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const props = { receipt, onClose, onSaved, onSavingChange: setSaving };
  return (
    <AdminModal
      title={titles[action.kind]}
      onClose={onClose}
      isCloseDisabled={saving}
    >
      {action.kind === "place" ? (
        <ReceiptPlaceForm {...props} line={action.line} actorId={actorId} />
      ) : action.kind === "item" ? (
        <ReceiptItemMapForm {...props} line={action.line} />
      ) : action.kind === "resolve" ? (
        <ReceiptConflictResolveForm
          {...props}
          canReconcileStock={canReconcileStock}
        />
      ) : (
        <ReceiptCancelForm {...props} />
      )}
    </AdminModal>
  );
}
