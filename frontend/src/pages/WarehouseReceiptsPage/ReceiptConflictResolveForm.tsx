import { useState } from "react";
import { ApiRequestError } from "../../shared/api/api-error";
import { receiptsApi } from "../../shared/api/warehouse-receipts-api";
import {
  AdminFormActions,
  AdminTextareaField as TextareaField,
} from "../../shared/ui/AdminFormControls";
import { SelectField } from "../../shared/ui/SelectField";
import { Notice } from "../../shared/ui/Notice";
import {
  useReceiptActionForm,
  type ReceiptActionFormProps,
} from "./useReceiptActionForm";

type Shortage = {
  itemId: string;
  name: string;
  unit: string;
  required: string;
  physical: string;
  shortage: string;
};

export function ReceiptConflictResolveForm(props: ReceiptActionFormProps) {
  const { receipt, onClose } = props;
  const [reason, setReason] = useState("");
  const [decision, setDecision] = useState("KEEP_CURRENT");
  const [confirmed, setConfirmed] = useState(false);
  const [shortages, setShortages] = useState<Shortage[]>([]);
  const canAcceptCancellation =
    receipt.conflict === "SOURCE_CANCELLED_AFTER_PLACEMENT";
  const accept = canAcceptCancellation && decision === "ACCEPT_CANCELLATION";
  const { saving, error, submit } = useReceiptActionForm(props);
  const disabled =
    !receipt.sourceVersion || !reason.trim() || (accept && !confirmed);

  return (
    <form
      className="admin-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled || !receipt.sourceVersion) return;
        const sourceVersion = receipt.sourceVersion;
        setShortages([]);
        void submit(
          () =>
            receiptsApi.resolve(receipt.id, {
              action: accept ? "ACCEPT_CANCELLATION" : "KEEP_CURRENT",
              reason: reason.trim(),
              sourceVersion,
            }),
          (failure) => {
            if (
              failure instanceof ApiRequestError &&
              failure.code ===
                "WAREHOUSE_RECEIPT_CANCELLATION_STOCK_INSUFFICIENT"
            ) {
              setShortages(
                (failure.details as { shortages?: Shortage[] } | undefined)
                  ?.shortages ?? [],
              );
            }
            return false;
          },
        );
      }}
    >
      <fieldset disabled={saving} className="receipt-fields">
        {canAcceptCancellation ? (
          <SelectField
            label="Решение"
            value={decision}
            onChange={(value) => {
              setDecision(value);
              setConfirmed(false);
              setShortages([]);
            }}
            options={[
              { value: "KEEP_CURRENT", label: "Сохранить текущий документ" },
              { value: "ACCEPT_CANCELLATION", label: "Принять отмену 1С" },
            ]}
          />
        ) : (
          <p>Будет сохранён текущий документ.</p>
        )}
        <TextareaField
          label="Обоснование"
          required
          value={reason}
          onChange={setReason}
          maxLength={4000}
        />
        {accept && (
          <label className="receipt-cancellation-confirmation">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              required
            />
            <span>
              Подтверждаю отмену документа 1С. Остатки и резервы сохранятся.
            </span>
          </label>
        )}
      </fieldset>
      {error && (
        <Notice tone="error">
          {error}
          {accept && shortages.length > 0 && (
            <ul>
              {shortages.map(
                ({ itemId, name, unit, required, physical, shortage }) => (
                  <li key={itemId}>
                    {name} · требуется {required} {unit}, в наличии {physical}{" "}
                    {unit}, не хватает {shortage} {unit}
                  </li>
                ),
              )}
            </ul>
          )}
        </Notice>
      )}
      <AdminFormActions
        isSaving={saving}
        onClose={onClose}
        submitDisabled={disabled}
      />
    </form>
  );
}
