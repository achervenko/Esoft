import {
  placementLocationOptions,
  useReceiptLocationHints,
} from "./useReceiptLocationHints";
import { useState } from "react";
import { WarehouseItemIdentity } from "../../shared/warehouse/WarehouseItemIdentity";
import {
  receiptsApi,
  type ReceiptLine,
} from "../../shared/api/warehouse-receipts-api";
import {
  AdminFormActions,
  AdminTextField as TextField,
} from "../../shared/ui/AdminFormControls";
import { SelectField } from "../../shared/ui/SelectField";
import { Notice } from "../../shared/ui/Notice";
import {
  useReceiptActionForm,
  type ReceiptActionFormProps,
} from "./useReceiptActionForm";
import { ApiRequestError } from "../../shared/api/api-error";
import { useReceiptSubmission } from "./useReceiptSubmission";
import { quantityError, quantityMilli } from "./receipt-utils";
import { useReceiptStorage } from "./useReceiptStorage";
function requiresAllocation(error: ApiRequestError) {
  return (
    error.status === 409 &&
    (error.code === "WAREHOUSE_RECEIPT_RESERVATION_ALLOCATION_REQUIRED" ||
      error.code === "WAREHOUSE_RESERVATION_DEFICIT_INSUFFICIENT")
  );
}

function fromMillis(value: bigint) {
  const fraction = (value % 1000n)
    .toString()
    .padStart(3, "0")
    .replace(/0+$/, "");
  return value / 1000n + (fraction ? "." + fraction : "");
}

export function ReceiptPlaceForm(
  props: ReceiptActionFormProps & {
    line: ReceiptLine;
    actorId: string | null;
    inline?: boolean;
    canReadStock?: boolean;
    disabled?: boolean;
  },
) {
  const { receipt, line, actorId, onClose, inline = false } = props;
  const hints = useReceiptLocationHints(
    line.itemId,
    receipt.warehouseId,
    props.canReadStock ?? false,
  );
  const choices = useReceiptStorage(receipt.warehouseId ?? "");
  const [locationId, setLocation] = useState("");
  const [quantity, setQuantity] = useState(line.remaining);
  const [remaining, setRemaining] = useState(line.remaining);
  const [placementBlocked, setPlacementBlocked] = useState(false);
  const [placementError, setPlacementError] = useState<string | null>(null);
  const [reportedDeficit, setDeficit] = useState<string>();
  const deficit = reportedDeficit ?? line.reservationDeficit ?? null;
  const [restore, setRestore] = useState("");
  const submission = useReceiptSubmission<
    Omit<Parameters<typeof receiptsApi.place>[2], "requestKey">
  >(actorId, `place:${receipt.id}:${line.id}`);
  const { saving, error, submit } = useReceiptActionForm(props);
  const amountError = !submission.pending
    ? quantityError(quantity, remaining)
    : null;
  const restored = quantityMilli(restore);
  const amount = quantityMilli(quantity);
  const maxRestore = deficit === null ? null : quantityMilli(deficit);
  const validAllocation =
    restored !== null &&
    amount !== null &&
    maxRestore !== null &&
    restored <= amount &&
    restored <= maxRestore;
  const increase = validAllocation ? fromMillis(amount - restored) : null;
  const allocation = submission.pending?.body.reservationAllocation;
  const disabled =
    placementBlocked ||
    remaining === "0" ||
    !locationId ||
    !!amountError ||
    (deficit !== null && !validAllocation);
  const place = async () => {
    setPlacementError(null);
    try {
      await submission.submit(
        {
          storageLocationId: locationId,
          quantity: quantity.replace(",", "."),
          ...(increase === null
            ? {}
            : {
                reservationAllocation: {
                  restoreQuantity: restore.replace(",", "."),
                  increaseQuantity: increase,
                },
              }),
        },
        (value) => receiptsApi.place(receipt.id, line.id, value),
        requiresAllocation,
      );
    } catch (err) {
      if (
        err instanceof ApiRequestError &&
        err.code === "WAREHOUSE_RECEIPT_OVERPLACEMENT"
      ) {
        setPlacementBlocked(true);
        try {
          const updated = await receiptsApi.get(receipt.id);
          const updatedLine = updated.lines.find(
            (candidate) => candidate.id === line.id,
          );
          if (!updatedLine) throw new Error("Строка прихода изменилась.");
          setRemaining(updatedLine.remaining);
          setPlacementBlocked(
            !!updated.conflict ||
              updated.status === "CANCELLED" ||
              !!updatedLine.reconciledToLineId,
          );
          setPlacementError(
            updatedLine.remaining === "0"
              ? "Товар уже полностью размещён. Повторное размещение не выполнено."
              : `Часть товара уже размещена. Осталось разместить: ${updatedLine.remaining} ${updatedLine.unit}. Уменьшите количество.`,
          );
        } catch {
          setPlacementError(
            "Количество к размещению изменилось. Не удалось обновить данные. Закройте форму и обновите приход перед повтором.",
          );
        }
      }
      throw err;
    }
  };
  const handleAllocationError = (error: unknown) => {
    if (!(error instanceof ApiRequestError) || !requiresAllocation(error))
      return false;
    const { details } = error;
    if (
      !details ||
      typeof details !== "object" ||
      !("deficitQuantity" in details) ||
      typeof details.deficitQuantity !== "string" ||
      quantityMilli(details.deficitQuantity) === null
    )
      return false;
    setDeficit(details.deficitQuantity);
    setRestore("");
    return true;
  };
  return (
    <form
      className="admin-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (props.disabled || (disabled && !submission.pending)) return;
        void submit(place, handleAllocationError);
      }}
    >
      <fieldset
        disabled={props.disabled || saving || !!submission.pending}
        className="receipt-fields"
      >
        <>
          {!inline && (
            <WarehouseItemIdentity name={line.name} article={line.article} />
          )}
          <SelectField
            label="Место хранения"
            required
            value={submission.pending?.body.storageLocationId ?? locationId}
            onChange={setLocation}
            searchable
            placeholder=""
            options={placementLocationOptions(
              choices.locations,
              hints.balances,
              line.unit,
            ).map((option) => ({
              ...option,
              title: option.label,
              content: (
                <span className="receipt-location-option">
                  <span>{option.label}</span>
                  {option.quantityLabel && (
                    <small>{option.quantityLabel}</small>
                  )}
                </span>
              ),
            }))}
          />
          <TextField
            label={`Количество, ${line.unit}`}
            required
            value={submission.pending?.body.quantity ?? quantity}
            onChange={setQuantity}
            inputMode="decimal"
            error={amountError ?? undefined}
          />
          <small className="receipt-hint">
            Осталось разместить: {remaining} {line.unit}
          </small>
          {(deficit !== null || allocation) && (
            <TextField
              label={`Закрыть дефицит, ${line.unit}`}
              fieldClassName="form-field-wide"
              required
              hint={
                deficit !== null
                  ? `Дефицит по заказу: ${deficit} ${line.unit}`
                  : undefined
              }
              inputMode="decimal"
              value={allocation?.restoreQuantity ?? restore}
              onChange={setRestore}
              error={
                !allocation && restore !== "" && !validAllocation
                  ? "Введите количество в пределах дефицита и размещаемого количества."
                  : undefined
              }
            />
          )}
        </>
      </fieldset>
      {hints.error && (
        <small className="receipt-hint">
          Остатки по местам не удалось загрузить. Можно выбрать любое место.
        </small>
      )}
      {(placementError ?? error ?? choices.error) && (
        <Notice tone="error">{placementError ?? error ?? choices.error}</Notice>
      )}
      {submission.pending && !saving && (
        <Notice>
          Предыдущая отправка ещё не подтверждена. Повторный запрос проверит её
          результат без нового размещения.
        </Notice>
      )}
      {inline ? (
        <button
          className="admin-primary-button"
          type="submit"
          disabled={
            props.disabled || saving || (disabled && !submission.pending)
          }
        >
          {saving
            ? "Размещение…"
            : submission.pending
              ? "Проверить размещение"
              : "Разместить"}
        </button>
      ) : (
        <AdminFormActions
          isSaving={saving}
          onClose={onClose}
          submitDisabled={!!props.disabled || (disabled && !submission.pending)}
        />
      )}
    </form>
  );
}
