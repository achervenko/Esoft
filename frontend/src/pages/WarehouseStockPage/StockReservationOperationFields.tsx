import {
  AdminTextField,
  AdminTextareaField,
} from "../../shared/ui/AdminFormControls";
import { SelectField } from "../../shared/ui/SelectField";
import { formatStockQuantity } from "./stock-page.utils";
import type { useStockReservationOperation } from "./useStockReservationOperation";
export function StockReservationOperationFields({
  form,
  unit,
}: {
  form: ReturnType<typeof useStockReservationOperation>;
  unit: string;
}) {
  const {
    action,
    setAction,
    quantity,
    setQuantity,
    comment,
    setComment,
    borrowed,
    normalized,
    amount,
    maximum,
  } = form;
  return (
    <>
      <SelectField
        label="Действие"
        value={action}
        onChange={(v) => {
          setAction(v as typeof action);
          setQuantity("");
        }}
        options={[
          { value: "RELEASE", label: "Снять резерв" },
          { value: "BORROW", label: "Заимствовать из резерва" },
          ...(borrowed > 0n
            ? [{ value: "RESTORE", label: "Восстановить резерв" }]
            : []),
        ]}
      />
      <AdminTextField
        label={`Количество, ${unit}`}
        value={quantity}
        onChange={setQuantity}
        inputMode="decimal"
        error={
          !normalized
            ? undefined
            : amount === null || amount === 0n
              ? "Укажите положительное количество."
              : amount > maximum
                ? `Доступно: ${formatStockQuantity(`${maximum / 1000n}.${(maximum % 1000n).toString().padStart(3, "0")}`.replace(/\.?0+$/, ""))} ${unit}.`
                : undefined
        }
        required
      />
      <AdminTextareaField
        label="Комментарий"
        value={comment}
        onChange={setComment}
        maxLength={1000}
        required
      />
    </>
  );
}
