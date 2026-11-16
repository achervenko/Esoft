import { useState } from "react";
import { Notice } from "../../shared/ui/Notice";
import { TextField } from "../../shared/ui/TextField";
import { SelectField } from "../../shared/ui/SelectField";
import { useReservationPlaces } from "./useReservationPlaces";
import {
  formatStockQuantity,
  quantityMillis,
} from "../../shared/lib/warehouse-quantity";
import {
  decimalQuantity,
  useReservationOperation,
} from "./useReservationOperation";
import {
  operationTitles,
  type ReservationOperation,
} from "./reservation-operation";
import { ReservationCreateForm } from "./ReservationCreateForm";
import { ReservationOperationModal } from "./ReservationOperationModal";

export type ReservationOperationFormProps = {
  operation: ReservationOperation;
  orderId?: string;
  actorId?: string | null;
  onClose: () => void;
  onSaved: () => void;
  onRefresh: () => void;
};

export function ReservationOperationForm(props: ReservationOperationFormProps) {
  return props.operation.kind === "reserve" ? (
    <ReservationCreateForm {...props} />
  ) : (
    <ReservationEditForm {...props} operation={props.operation} />
  );
}

function ReservationEditForm({
  operation: initialOperation,
  orderId,
  actorId,
  onClose,
  onSaved,
  onRefresh,
}: ReservationOperationFormProps & {
  operation: Exclude<ReservationOperation, { kind: "reserve" }>;
}) {
  const [decrease, setDecrease] = useState(false);
  const canChoose =
    (initialOperation.kind === "reduce" ||
      initialOperation.kind === "restore") &&
    initialOperation.canDecrease;
  const operation: ReservationOperation =
    decrease && canChoose
      ? {
          kind: "demand",
          reservation: initialOperation.reservation,
          canCover: true,
        }
      : initialOperation;
  const form = useReservationOperation(
    operation,
    orderId ?? "",
    onSaved,
    actorId,
  );
  const selectedItemId = form.r?.item.id ?? "";
  const choices = useReservationPlaces(
    selectedItemId,
    operation.kind === "restore" ||
      (operation.kind === "demand" && !!operation.canCover) ||
      operation.kind === "reduce",
  );
  const places = choices.locations.filter(
    (location) =>
      (quantityMillis(choices.free?.[location.id] ?? "") ?? 0n) > 0n,
  );
  const needsPlace = operation.kind === "restore";
  const demandIncrease = operation.kind === "demand" && form.demandDelta > 0n;
  const showPlace = needsPlace || (demandIncrease && !!operation.canCover);
  const free = quantityMillis(
    choices.free?.[
      operation.kind === "reduce" ? operation.locationId : form.locationId
    ] ?? "0",
  );
  const extraCoverage =
    operation.kind === "reduce"
      ? -form.reduction
      : operation.kind === "restore"
        ? (quantityMillis(form.quantity.replace(",", ".")) ?? 0n)
        : demandIncrease
          ? (form.coverAmount ?? 0n)
          : 0n;
  const exceedsFree =
    extraCoverage > 0n && free !== null && extraCoverage > free;
  const exceedsDemand =
    operation.kind === "reduce" && extraCoverage > form.currentDeficit;
  const switchToDemand = () => {
    if (initialOperation.kind === "reduce")
      form.setLocationId(initialOperation.locationId);
    setDecrease(true);
  };
  return (
    <ReservationOperationModal
      title={
        canChoose ? "Операции с резервом" : operationTitles[operation.kind]
      }
      form={form}
      onClose={onClose}
      onRefresh={onRefresh}
      onSubmit={(event) => {
        event.preventDefault();
        void form.submit(event, "");
      }}
      commentRequired
      placeError={showPlace || extraCoverage > 0n ? choices.error : null}
      retryPlaces={choices.retry}
      blockSave={
        exceedsFree ||
        ((needsPlace || extraCoverage > 0n) &&
          (choices.loading || !!choices.error))
      }
    >
      {canChoose && (
        <SelectField
          label="Операция"
          value={decrease ? "decrease" : "reduce"}
          onChange={(value) =>
            value === "decrease" ? switchToDemand() : setDecrease(false)
          }
          disabled={form.locked}
          options={[
            { value: "reduce", label: operationTitles.reduce },
            { value: "decrease", label: operationTitles.demand },
          ]}
        />
      )}
      {operation.kind === "demand" && (
        <TextField
          label={`Потребность, ${form.r?.item.unit}`}
          required
          inputMode="decimal"
          value={form.demand}
          onChange={form.setDemand}
        />
      )}
      {showPlace && (
        <SelectField
          label={"Место хранения"}
          required={needsPlace}
          searchable
          value={form.locationId}
          onChange={form.setLocationId}
          disabled={!selectedItemId || choices.loading || !!choices.error}
          options={places.map((l) => {
            const label = `${l.warehouse.name} — ${l.name}`;
            const freeQuantity = formatStockQuantity(
              choices.free?.[l.id] ?? "0",
            );
            return {
              value: l.id,
              label: `${label} · свободно ${freeQuantity} ${form.r?.item.unit}`,
            };
          })}
        />
      )}
      {needsPlace &&
        selectedItemId &&
        !choices.loading &&
        !choices.error &&
        !places.length && (
          <Notice>
            У этой номенклатуры нет остатков в активных местах хранения.
          </Notice>
        )}
      {demandIncrease && operation.canCover && form.locationId && (
        <TextField
          label={`Взять из свободного остатка, ${form.r?.item.unit}`}
          inputMode="decimal"
          value={form.cover}
          onChange={form.setCover}
        />
      )}
      {operation.kind === "decrease" ||
      (operation.kind === "demand" && form.release > 0n) ? (
        <>
          {form.r?.allocations.map((a) => (
            <TextField
              key={a.id}
              label={`${a.location.warehouse.name} — ${a.location.name} (до ${formatStockQuantity(a.quantity)} ${form.r?.item.unit})`}
              inputMode="decimal"
              value={form.allocations[a.location.id] ?? ""}
              onChange={(value) =>
                form.setAllocations((previous) => ({
                  ...previous,
                  [a.location.id]: value,
                }))
              }
            />
          ))}
          {operation.kind === "decrease" && form.r?.deficitQuantity !== "0" && (
            <TextField
              label={`Снять из дефицита (до ${formatStockQuantity(form.r?.deficitQuantity ?? "0")})`}
              inputMode="decimal"
              value={form.deficitQuantity}
              onChange={form.setDeficitQuantity}
            />
          )}
          {operation.kind === "demand" ? (
            <p>
              Освободите {formatStockQuantity(decimalQuantity(form.release))}{" "}
              {form.r?.item.unit} из указанных мест.
            </p>
          ) : (
            <Notice>
              Потребность уменьшится на {form.decreasePreview}{" "}
              {form.r?.item.unit}. Указанные количества будут освобождены с
              выбранных мест.
            </Notice>
          )}
        </>
      ) : (
        operation.kind !== "demand" && (
          <TextField
            label={`${operation.kind === "reduce" ? "Оставить обеспеченным" : "Количество"}${form.r ? `, ${form.r.item.unit}` : ""}`}
            required
            inputMode="decimal"
            value={form.quantity}
            onChange={form.setQuantity}
          />
        )
      )}
      {operation.kind === "reduce" &&
        form.reduction !== 0n &&
        !exceedsDemand && (
          <p>
            {form.reduction > 0n
              ? "В свободный остаток вернётся"
              : "Из свободного остатка будет взято"}{" "}
            {formatStockQuantity(
              decimalQuantity(
                form.reduction > 0n ? form.reduction : -form.reduction,
              ),
            )}{" "}
            {form.r?.item.unit}.
          </p>
        )}
      {exceedsDemand && (
        <Notice>
          Чтобы закрепить это количество, увеличьте потребность заказа.
          {canChoose && operation.kind === "reduce" && form.r && (
            <button
              type="button"
              className="admin-secondary-button"
              onClick={() => {
                const current = quantityMillis(form.r!.quantity) ?? 0n;
                form.setDemand(
                  formatStockQuantity(
                    decimalQuantity(
                      current + extraCoverage - form.currentDeficit,
                    ),
                  ),
                );
                form.setCover(
                  formatStockQuantity(decimalQuantity(extraCoverage)),
                );
                switchToDemand();
              }}
            >
              Изменить потребность
            </button>
          )}
        </Notice>
      )}
      {exceedsFree && (
        <Notice tone="error">
          В выбранном месте недостаточно свободного остатка.
        </Notice>
      )}
    </ReservationOperationModal>
  );
}
