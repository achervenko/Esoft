import { useState } from "react";
import { receiptsApi } from "../../shared/api/warehouse-receipts-api";
import {
  AdminFormActions,
  AdminTextField as TextField,
  AdminTextareaField as TextareaField,
} from "../../shared/ui/AdminFormControls";
import { SelectField } from "../../shared/ui/SelectField";
import { Notice } from "../../shared/ui/Notice";
import {
  useReceiptActionForm,
  type ReceiptActionFormProps,
} from "./useReceiptActionForm";
export function ReceiptConflictResolveForm(
  props: ReceiptActionFormProps & { canReconcileStock?: boolean },
) {
  const { receipt, onClose } = props;
  const [adjustmentIds, setAdjustmentIds] = useState("");
  const [reason, setReason] = useState("");
  const [decision, setDecision] = useState("KEEP_CURRENT");
  const canAcceptCancellation =
    receipt.conflict === "SOURCE_CANCELLED_AFTER_PLACEMENT";
  const { saving, error, submit } = useReceiptActionForm(props);
  const ids = adjustmentIds.split(/[,\s]+/).filter(Boolean);
  const disabled =
    !reason.trim() ||
    (decision === "RECONCILE_CANCELLATION" &&
      (!ids.length || ids.some((id) => !/^[1-9]\d*$/.test(id))));
  return (
    <form
      className="admin-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (disabled) return;
        void submit(() =>
          receipt.sourceVersion
            ? receiptsApi.resolve(receipt.id, {
                action: canAcceptCancellation
                  ? (decision as
                      | "KEEP_CURRENT"
                      | "ACCEPT_CANCELLATION"
                      | "RECONCILE_CANCELLATION")
                  : "KEEP_CURRENT",
                reason: reason.trim(),
                sourceVersion: receipt.sourceVersion,
                ...(decision === "RECONCILE_CANCELLATION"
                  ? { adjustmentIds: ids }
                  : {}),
              })
            : Promise.resolve(),
        );
      }}
    >
      <fieldset disabled={saving} className="receipt-fields">
        <>
          <Notice>
            Решение не изменяет физические остатки. При необходимости оформите
            отдельную корректировку.
          </Notice>
          {canAcceptCancellation ? (
            <SelectField
              label="Решение"
              value={decision}
              onChange={setDecision}
              options={[
                {
                  value: "KEEP_CURRENT",
                  label: "Сохранить текущий документ",
                },
                ...(props.canReconcileStock
                  ? [
                      {
                        value: "RECONCILE_CANCELLATION",
                        label: "Согласовать с 1С после корректировки",
                      },
                    ]
                  : []),
                ...(canAcceptCancellation
                  ? [
                      {
                        value: "ACCEPT_CANCELLATION",
                        label: "Принять отмену 1С",
                      },
                    ]
                  : []),
              ]}
            />
          ) : (
            <p>Будет сохранён текущий документ.</p>
          )}
          {decision === "RECONCILE_CANCELLATION" && (
            <TextField
              label="Номера проведённых корректировок"
              required
              value={adjustmentIds}
              onChange={setAdjustmentIds}
              placeholder="Например: 12, 13"
            />
          )}
          <TextareaField
            label="Обоснование"
            required
            value={reason}
            onChange={setReason}
            maxLength={4000}
          />
        </>
      </fieldset>
      {error && <Notice tone="error">{error}</Notice>}
      <AdminFormActions
        isSaving={saving}
        onClose={onClose}
        submitDisabled={disabled}
      />
    </form>
  );
}
