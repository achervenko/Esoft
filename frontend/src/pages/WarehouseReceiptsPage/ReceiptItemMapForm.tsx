import { useState } from "react";
import {
  receiptsApi,
  type ReceiptLine,
} from "../../shared/api/warehouse-receipts-api";
import {
  AdminFormActions,
  AdminTextField as TextField,
} from "../../shared/ui/AdminFormControls";
import { Notice } from "../../shared/ui/Notice";
import {
  useReceiptActionForm,
  type ReceiptActionFormProps,
} from "./useReceiptActionForm";
import type { WarehouseItem } from "../../shared/api/warehouse-catalog-api";
import { ReceiptItemPicker } from "../../shared/warehouse/ReceiptItemPicker";
export function ReceiptItemMapForm(
  props: ReceiptActionFormProps & { line: ReceiptLine },
) {
  const { receipt, line, onClose } = props;
  const [item, setItem] = useState<WarehouseItem | null>(null);
  const [create, setCreate] = useState(false);
  const [article, setArticle] = useState(line.sourceArticle ?? "");
  const [name, setName] = useState(line.name);
  const [unit, setUnit] = useState(line.unit);
  const { saving, error, submit } = useReceiptActionForm(props);
  const disabled = create
    ? !article.trim() || !name.trim() || !unit.trim()
    : !item;
  return (
    <form
      className="admin-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (disabled) return;
        void submit(() =>
          receiptsApi.mapItem(
            receipt.id,
            line.id,
            create
              ? {
                  create: {
                    article: article.trim(),
                    name: name.trim(),
                    unit: unit.trim(),
                  },
                }
              : { itemId: item!.id },
          ),
        );
      }}
    >
      <fieldset disabled={saving} className="receipt-fields">
        <>
          <Notice>
            Единица источника: {line.unit}. Выберите тот же товар с той же
            единицей. Связь применяется к этому внешнему ID и в других приходах.
          </Notice>
          <button
            type="button"
            className="admin-secondary-button"
            onClick={() => setCreate(!create)}
          >
            {create ? "Выбрать существующую" : "Создать новую номенклатуру"}
          </button>
          {create ? (
            <>
              <TextField
                label="Канонический артикул"
                required
                value={article}
                onChange={setArticle}
                maxLength={100}
              />
              <TextField
                label="Название"
                required
                value={name}
                onChange={setName}
                maxLength={255}
              />
              <TextField
                label="Единица измерения"
                required
                value={unit}
                onChange={setUnit}
                maxLength={50}
              />
            </>
          ) : (
            <ReceiptItemPicker value={item} onChange={setItem} />
          )}
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
