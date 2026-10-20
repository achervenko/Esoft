import type { PpeNorm } from "../../shared/api/ppe";
import { businessToday } from "../../modules/ppe-ui/ppe-presentation";
export type NormFormState = (
  | { mode: "create"; norm: null }
  | { mode: "revision"; norm: PpeNorm }
  | { mode: "edit"; norm: PpeNorm }
) & { transitionMode?: "SOFT" | "HARD" };
export function normPeriodStatus(norm: PpeNorm, today = businessToday()) {
  return norm.effectiveFrom > today
    ? "Будущая"
    : norm.effectiveTo && norm.effectiveTo < today
      ? "Завершённая"
      : "Действующая";
}

export function getNeighborNorms(norms: PpeNorm[], current: PpeNorm) {
  return {
    previousNorm:
      norms
        .filter((norm) => norm.gender === current.gender && norm.positionId === current.positionId && norm.effectiveFrom < current.effectiveFrom)
        .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] ??
      null,
    nextNorm:
      norms
        .filter((norm) => norm.gender === current.gender && norm.positionId === current.positionId && norm.effectiveFrom > current.effectiveFrom)
        .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0] ??
      null,
  };
}
