import { receiptsApi } from "../../shared/api/warehouse-receipts-api";
import { AdminFormActions } from "../../shared/ui/AdminFormControls";
import { Notice } from "../../shared/ui/Notice";
import {
  useReceiptActionForm,
  type ReceiptActionFormProps,
} from "./useReceiptActionForm";
export function ReceiptCancelForm(props: ReceiptActionFormProps) {
  const { receipt, onClose } = props;
  const { saving, error, submit } = useReceiptActionForm(props);
  const disabled = false;
  return (
    <form
      className="admin-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (disabled) return;
        void submit(() => receiptsApi.cancel(receipt.id));
      }}
    >
      <fieldset disabled={saving} className="receipt-fields">
        <Notice>
          Отменить ручной приход? Размещений по нему быть не должно.
        </Notice>
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
