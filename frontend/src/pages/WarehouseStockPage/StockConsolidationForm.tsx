import {
  readPendingStockMovement,
  persistStockMovement,
  clearPendingStockMovement,
} from "./pending-stock-movement";
import "./StockConsolidationForm.css";
import { useEffect, useRef, useState } from "react";
import {
  warehouseStockApi,
  type StockDistribution,
  type StockConsolidationInput,
} from "../../shared/api/warehouse-stock-api";
import { SelectField } from "../../shared/ui/SelectField";
import { Notice } from "../../shared/ui/Notice";
import { AppTable } from "../../shared/ui/AppTable";
import {
  ApiRequestError,
  getApiErrorMessage,
} from "../../shared/api/api-error";
import { useStorageChoices } from "./useStorageChoices";
import { StockTransferProduct } from "./StockTransferPreview";
import {
  formatStockQuantity,
  quantityMillis,
  transferRequestKey,
} from "./stock-page.utils";

export function StockConsolidationForm({
  data,
  onClose,
  onSaved,
  onSavingChange,
}: {
  data: StockDistribution;
  onClose: () => void;
  onSaved: () => void;
  onSavingChange: (saving: boolean) => void;
}) {
  const [restored] = useState(() => {
    const saved = readPendingStockMovement();
    return saved?.kind === "consolidation" &&
      saved.input.itemId === data.item.id &&
      saved.input.fromWarehouseId === data.warehouse.id
      ? saved
      : null;
  });
  const [warehouseId, setWarehouse] = useState(
    restored?.warehouseId ?? data.warehouse.id,
  );
  const [locationId, setLocation] = useState(
    restored?.input.toLocationId ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<StockConsolidationInput | null>(
    restored?.input ?? null,
  );
  const busy = useRef(false);
  useEffect(() => {
    onSavingChange(saving || !!pending);
  }, [saving, pending, onSavingChange]);
  const choices = useStorageChoices(true, warehouseId, true);
  const moves: StockConsolidationInput["moves"] =
    pending?.moves ??
    data.locations
      .filter((b) => b.location.id !== locationId)
      .filter((b) => (quantityMillis(b.quantity) ?? 0n) > 0n)
      .map((b) => ({ fromLocationId: b.location.id, quantity: b.quantity }));
  const total = moves.reduce(
    (sum, m) => sum + (quantityMillis(m.quantity) ?? 0n),
    0n,
  );
  const displayTotal =
    `${total / 1000n}.${(total % 1000n).toString().padStart(3, "0")}`.replace(
      /\.?0+$/,
      "",
    );
  return (
    <form
      className="admin-form stock-consolidation-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          busy.current ||
          (!pending &&
            (!locationId || !moves.length || choices.loading || choices.error))
        )
          return;
        busy.current = true;
        setSaving(true);
        onSavingChange(true);
        setError(null);
        const attempt = pending ?? {
          requestKey: transferRequestKey(),
          itemId: data.item.id,
          fromWarehouseId: data.warehouse.id,
          toLocationId: locationId,
          moves,
        };
        try {
          await persistStockMovement({
            kind: "consolidation",
            data,
            input: attempt,
            warehouseId,
          });
        } catch (e) {
          setError(getApiErrorMessage(e));
          busy.current = false;
          setSaving(false);
          onSavingChange(!!pending);
          return;
        }
        setPending(attempt);
        try {
          await warehouseStockApi.consolidate(attempt);
          clearPendingStockMovement(attempt.requestKey);
          setPending(null);
          onSavingChange(false);
          onSaved();
        } catch (error) {
          // Business conflicts are checked after the idempotency lookup. A retry
          // denied before that lookup (e.g. 401/403) cannot rule out an earlier commit.
          if (
            error instanceof ApiRequestError &&
            error.status >= 400 &&
            error.status < 500 &&
            error.status !== 408 &&
            (!pending ||
              (error.status === 409 &&
                error.code?.startsWith("WAREHOUSE_") &&
                error.code !== "WAREHOUSE_TRANSFER_REQUEST_CONFLICT"))
          ) {
            clearPendingStockMovement(attempt.requestKey);
            setPending(null);
          }
          setError(getApiErrorMessage(error));
        } finally {
          busy.current = false;
          setSaving(false);
        }
      }}
    >
      <StockTransferProduct data={data} />
      <p>Выберите склад и место назначения.</p>
      <section
        className="stock-transfer-section"
        aria-label="Откуда перемещается товар"
      >
        <h3>Откуда</h3>
        <AppTable incremental={false}>
          <thead>
            <tr>
              <th>Место хранения</th>
              <th className="stock-distribution-quantity">Количество</th>
            </tr>
          </thead>
          <tbody>
            {moves.map((move) => {
              const balance = data.locations.find(
                (b) => b.location.id === move.fromLocationId,
              )!;
              return (
                <tr key={move.fromLocationId}>
                  <td>{balance.location.name}</td>
                  <td className="stock-distribution-quantity">
                    {formatStockQuantity(move.quantity)} {data.item.unit}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </AppTable>
        {!moves.length && <p>Всё уже находится в выбранном месте.</p>}
      </section>
      <fieldset
        className="stock-transfer-section"
        disabled={saving || !!pending}
      >
        <SelectField
          label="Склад назначения"
          value={warehouseId}
          onChange={(id) => {
            setWarehouse(id);
            setLocation("");
          }}
          searchable
          options={choices.warehouses.map((w) => ({
            value: w.id,
            label: w.name,
          }))}
          disabled={choices.loading}
        />
        <SelectField
          label="Место назначения"
          value={locationId}
          onChange={setLocation}
          searchable
          required
          options={choices.locations.map((l) => ({
            value: l.id,
            label: l.name,
          }))}
          disabled={choices.loading}
        />
      </fieldset>
      {locationId && (
        <p>
          Будет перемещено:{" "}
          <strong>
            {formatStockQuantity(displayTotal)} {data.item.unit}
          </strong>
        </p>
      )}
      {choices.error && (
        <Notice tone="error">
          {choices.error}
          <button type="button" onClick={choices.retry}>
            Повторить загрузку
          </button>
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {pending && !saving && (
        <Notice>
          Результат пока не подтверждён. Повторите запрос: уже проведённое
          перемещение не выполнится второй раз.
        </Notice>
      )}
      <div className="admin-form-actions">
        <button
          type="button"
          className="admin-secondary-button"
          disabled={saving || !!pending}
          onClick={onClose}
        >
          Отмена
        </button>
        <button
          type="submit"
          className="admin-primary-button"
          disabled={
            saving ||
            (!pending &&
              (!locationId ||
                !moves.length ||
                choices.loading ||
                !!choices.error))
          }
        >
          {saving
            ? "Перемещение…"
            : pending
              ? "Повторить перемещение"
              : "Переместить всё"}
        </button>
      </div>
    </form>
  );
}
