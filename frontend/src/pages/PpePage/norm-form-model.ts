import type { NormPayload } from "../../shared/api/ppe";
import type { NormFormState } from "./norm-model";

export type DraftRow = {
  key: number;
  ppeItemId: string;
  quantity: string;
  periodCount: string;
  periodUnit: "DAY" | "MONTH" | "YEAR";
};

export function getNormMinFrom(state: NormFormState, today: string) {
  const revisionFrom =
    state.mode === "revision"
      ? new Date(
          Date.parse(`${state.norm.effectiveFrom}T00:00:00Z`) + 86_400_000,
        )
          .toISOString()
          .slice(0, 10)
      : today;
  return state.mode === "edit"
    ? new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000)
        .toISOString()
        .slice(0, 10)
    : state.mode === "revision" && revisionFrom > today
      ? revisionFrom
      : today;
}

export function validateNormDraft(
  gender: "MALE" | "FEMALE" | "",
  rows: DraftRow[],
):
  | { ok: true; gender: "MALE" | "FEMALE" }
  | { ok: false; error: string | null } {
  if (!gender) return { ok: false, error: null };
  if (!rows.length)
    return { ok: false, error: "Добавьте хотя бы одну строку нормы." };
  if (rows.some((row) => !row.ppeItemId)) return { ok: false, error: null };
  if (new Set(rows.map((row) => row.ppeItemId)).size !== rows.length)
    return { ok: false, error: "СИЗ не должен повторяться в одной норме." };
  return { ok: true, gender };
}

export function buildNormPayload({
  state,
  gender,
  transitionMode,
  from,
  to,
  rows,
}: {
  state: NormFormState;
  gender: "MALE" | "FEMALE";
  transitionMode: "SOFT" | "HARD";
  from: string;
  to: string;
  rows: DraftRow[];
}): NormPayload {
  return {
    ...(state.mode === "create" ? { gender } : {}),
    transitionMode,
    effectiveFrom: from,
    effectiveTo: to || null,
    items: rows.map((row) => ({
      ppeItemId: Number(row.ppeItemId),
      quantity: Number(row.quantity),
      periodCount: Number(row.periodCount),
      periodUnit: row.periodUnit,
    })),
  };
}
