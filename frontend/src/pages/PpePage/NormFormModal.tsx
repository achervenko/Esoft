import { Trash2 } from "lucide-react";
import { NormTransitionControl } from "./NormTransitionControl";
import { AppSelect } from "../../shared/ui/SelectDropdown/AppSelect";
import { useState } from "react";
import {
  ppeApi,
  type PpeItem,
  type PpePosition,
  type NormPayload,
} from "../../shared/api/ppe";
import { GuardedAdminModal } from "../../shared/ui/GuardedAdminModal";
import { useDraftChanges } from "../../shared/lib/use-draft-changes";
import { Field, Message } from "../../modules/ppe-ui/ppe-ui";
import { businessToday, ppeError } from "../../modules/ppe-ui/ppe-presentation";
import type { NormFormState } from "./norm-model";
type DraftRow = {
  key: number;
  ppeItemId: string;
  quantity: string;
  periodCount: string;
  periodUnit: "MONTH" | "YEAR";
  calculationMode: "LEGACY" | "INTERVAL" | "MONTHLY";
};
export function NormFormModal({
  state,
  position,
  items,
  onClose,
  onChanged,
}: {
  state: NormFormState;
  position: PpePosition;
  items: PpeItem[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const today = businessToday();
  const revisionFrom =
    state.mode === "revision"
      ? new Date(
          Date.parse(`${state.norm.effectiveFrom}T00:00:00Z`) + 86_400_000,
        )
          .toISOString()
          .slice(0, 10)
      : today;
  const minFrom =
    state.mode === "revision" && revisionFrom > today ? revisionFrom : today;
  const [from, setFrom] = useState(
    state.mode === "edit" ? state.norm.effectiveFrom : minFrom,
  );
  const [transitionMode, setTransitionMode] = useState<"SOFT" | "HARD">(
    state.transitionMode ??
      (state.mode === "edit" && state.norm?.transitionMode === "HARD"
        ? "HARD"
        : "SOFT"),
  );
  const [to, setTo] = useState(
    state.mode === "edit" ? (state.norm.effectiveTo ?? "") : "",
  );
  const [rows, setRows] = useState<DraftRow[]>(
    state.norm?.items.map((item, key) => ({
      key,
      ppeItemId: String(item.ppeItemId),
      quantity: String(item.quantity),
      periodCount: String(item.periodCount),
      periodUnit: item.periodUnit,
      calculationMode:
        item.calculationMode === "MONTHLY"
          ? "MONTHLY"
          : state.mode === "edit"
            ? (item.calculationMode ?? "LEGACY")
            : "INTERVAL",
    })) ?? [
      {
        key: 0,
        ppeItemId: "",
        quantity: "1",
        periodCount: "1",
        periodUnit: "YEAR",
        calculationMode: "INTERVAL",
      },
    ],
  );
  const hasChanges = useDraftChanges({
    from,
    to,
    transitionMode,
    rows: rows.map(({ key: _key, ...row }) => row),
  });
  const [nextKey, setNextKey] = useState(rows.length);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = (key: number, patch: Partial<DraftRow>) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  return (
    <GuardedAdminModal
      hasChanges={hasChanges}
      title={<>Должность: {position.name}</>}
      onClose={onClose}
      isCloseDisabled={saving}
      className="ppe-norm-form-modal"
    >
      <form
        className="ppe-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!rows.length) {
            setError("Добавьте хотя бы одну строку нормы.");
            return;
          }
          if (new Set(rows.map((row) => row.ppeItemId)).size !== rows.length) {
            setError("СИЗ не должен повторяться в одной норме.");
            return;
          }
          const payload: NormPayload = {
            transitionMode,
            effectiveFrom: from,
            effectiveTo: to || null,
            items: rows.map((row) => ({
              ppeItemId: Number(row.ppeItemId),
              quantity: Number(row.quantity),
              periodCount: Number(row.periodCount),
              periodUnit: row.periodUnit,
              calculationMode: row.calculationMode,
            })),
          };
          setSaving(true);
          setError(null);
          void ppeApi
            .saveNorm(state.mode, state.norm?.id ?? null, position.id, payload)
            .then(() => {
              onChanged();
              onClose();
            })
            .catch((err) => setError(ppeError(err)))
            .finally(() => setSaving(false));
        }}
      >
        <div className="ppe-toolbar">
          <Field label="Дата начала">
            <input
              required
              type="date"
              min={state.mode === "create" ? undefined : minFrom}
              value={from}
              disabled={saving}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="Дата окончания (необязательно)">
            <input
              type="date"
              min={from}
              value={to}
              disabled={saving}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
        </div>
        {state.mode !== "create" && (
          <NormTransitionControl
            hard={transitionMode === "HARD"}
            disabled={saving}
            onChange={(hard) => setTransitionMode(hard ? "HARD" : "SOFT")}
          />
        )}
        {rows.map((row) => (
          <fieldset className="ppe-draft-row" key={row.key} disabled={saving}>
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Расчёт выдачи">
                <AppSelect
                  value={row.calculationMode}
                  onChange={(e) =>
                    update(row.key, {
                      calculationMode: e.target
                        .value as DraftRow["calculationMode"],
                    })
                  }
                >
                  {row.calculationMode === "LEGACY" && (
                    <option value="LEGACY">Прежний график</option>
                  )}
                  <option value="INTERVAL">По сроку носки</option>
                  <option value="MONTHLY">Месячный объём</option>
                </AppSelect>
              </Field>
            </div>
            <Field label="СИЗ">
              <AppSelect
                required
                value={row.ppeItemId}
                onChange={(e) => update(row.key, { ppeItemId: e.target.value })}
              >
                <option value="">Выберите СИЗ</option>
                {items
                  .filter(
                    (item) =>
                      item.isActive || String(item.id) === row.ppeItemId,
                  )
                  .map((item) => (
                    <option
                      key={item.id}
                      value={item.id}
                      disabled={
                        !item.isActive ||
                        rows.some(
                          (other) =>
                            other.key !== row.key &&
                            other.ppeItemId === String(item.id),
                        )
                      }
                    >
                      {item.article} — {item.name}
                      {!item.isActive ? " (удалён)" : ""}
                    </option>
                  ))}
              </AppSelect>
            </Field>
            <Field label="Кол-во">
              <input
                required
                type="number"
                min="0.001"
                step="0.001"
                value={row.quantity}
                onChange={(e) => update(row.key, { quantity: e.target.value })}
              />
            </Field>
            <Field label="Период">
              <input
                required
                type="number"
                min="1"
                step="1"
                value={row.periodCount}
                onChange={(e) =>
                  update(row.key, { periodCount: e.target.value })
                }
              />
            </Field>
            <label className="ppe-field">
              <AppSelect
                aria-label="Единица периода"
                value={row.periodUnit}
                onChange={(e) =>
                  update(row.key, {
                    periodUnit: e.target.value as "MONTH" | "YEAR",
                  })
                }
              >
                <option value="YEAR">Год</option>
                <option value="MONTH">Месяц</option>
              </AppSelect>
            </label>
            <button
              className="admin-icon-button ppe-delete-icon-button"
              aria-label="Удалить"
              title="Удалить позицию нормы"
              type="button"
              onClick={() =>
                setRows((current) =>
                  current.filter((item) => item.key !== row.key),
                )
              }
            >
              <Trash2 aria-hidden="true" size={17} />
            </button>
          </fieldset>
        ))}
        <Message error={error} />
        <div className="ppe-norm-form-actions">
          <button
            className="admin-secondary-button"
            type="button"
            disabled={saving}
            onClick={() => {
              setRows((current) => [
                ...current,
                {
                  key: nextKey,
                  ppeItemId: "",
                  quantity: "1",
                  periodCount: "1",
                  periodUnit: "YEAR",
                  calculationMode: "INTERVAL",
                },
              ]);
              setNextKey((key) => key + 1);
            }}
          >
            Добавить
          </button>
          <button className="admin-primary-button" disabled={saving}>
            {saving ? "Сохранение..." : "Сохранить норму"}
          </button>
        </div>
      </form>
    </GuardedAdminModal>
  );
}
