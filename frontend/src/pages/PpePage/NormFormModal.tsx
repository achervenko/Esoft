import { GenderToggle } from "../../shared/ui/GenderToggle";
import { Plus } from "lucide-react";

import { NormTransitionControl } from "./NormTransitionControl";
import { useRef, useState } from "react";
import { ppeApi, type PpeItem, type PpePosition } from "../../shared/api/ppe";
import { GuardedAdminModal } from "../../shared/ui/GuardedAdminModal";
import { useDraftChanges } from "../../shared/lib/use-draft-changes";

import { Field, Message } from "../../modules/ppe-ui/ppe-ui";
import { businessToday, ppeError } from "../../modules/ppe-ui/ppe-presentation";
import type { NormFormState } from "./norm-model";
import { NormDraftRow } from "./NormDraftRow";
import {
  buildNormPayload,
  getNormMinFrom,
  validateNormDraft,
  type DraftRow,
} from "./norm-form-model";
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
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "">(
    state.norm?.gender ?? "",
  );
  const today = businessToday();
  const minFrom = getNormMinFrom(state, today);
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
    })) ?? [
      {
        key: 0,
        ppeItemId: "",
        quantity: "1",
        periodCount: "1",
        periodUnit: "YEAR",
      },
    ],
  );
  const hasChanges = useDraftChanges({
    gender,
    from,
    to,
    transitionMode,
    rows: rows.map(({ key: _key, ...row }) => row),
  });
  const [nextKey, setNextKey] = useState(rows.length);
  const [focusRowKey, setFocusRowKey] = useState<number | null>(null);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [genderValidated, setGenderValidated] = useState(false);
  const [validatedRowKeys, setValidatedRowKeys] = useState<Set<number>>(
    new Set(),
  );
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
          if (savingRef.current) return;
          setValidatedRowKeys(new Set(rows.map((row) => row.key)));
          const validation = validateNormDraft(gender, rows);
          if (!validation.ok) {
            if (!gender) setGenderValidated(true);
            setError(validation.error);
            return;
          }
          const payload = buildNormPayload({
            state,
            gender: validation.gender,
            transitionMode,
            from,
            to,
            rows,
          });
          savingRef.current = true;
          setSaving(true);
          setError(null);
          void ppeApi
            .saveNorm(state.mode, state.norm?.id ?? null, position.id, payload)
            .then(() => {
              onChanged();
              onClose();
            })
            .catch((err) => setError(ppeError(err)))
            .finally(() => {
              savingRef.current = false;
              setSaving(false);
            });
        }}
      >
        <GenderToggle
          value={gender}
          error={
            genderValidated && !gender ? "Выберите пол для нормы." : undefined
          }
          onInvalid={() => setGenderValidated(true)}
          onChange={setGender}
          disabled={saving || state.mode !== "create"}
        />
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
          <NormDraftRow
            key={row.key}
            row={row}
            rows={rows}
            items={items}
            disabled={saving}
            validated={validatedRowKeys.has(row.key)}
            focusOnMount={focusRowKey === row.key}
            onChange={(patch) => update(row.key, patch)}
            onRemove={() =>
              setRows((current) =>
                current.filter((item) => item.key !== row.key),
              )
            }
          />
        ))}
        <Message error={error} />
        <div className="ppe-norm-form-actions">
          <button
            className="admin-secondary-button"
            type="button"
            disabled={saving}
            onClick={() => {
              setFocusRowKey(nextKey);
              setRows((current) => [
                ...current,
                {
                  key: nextKey,
                  ppeItemId: "",
                  quantity: "1",
                  periodCount: "1",
                  periodUnit: "YEAR",
                },
              ]);
              setNextKey((key) => key + 1);
            }}
          >
            <Plus size={18} aria-hidden="true" />
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
