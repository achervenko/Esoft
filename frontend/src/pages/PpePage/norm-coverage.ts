import type { PpeEmployee, PpeNorm, PpePosition } from "../../shared/api/ppe";
import { businessToday } from "../../modules/ppe-ui/ppe-presentation";
import { normPeriodStatus } from "./norm-model";

export const normStatusLabels = {
  complete: "Нормы заданы",
  partial: "Неполные нормы",
  invalid: "Недействительные нормы",
  missing: "Нет норм",
} as const;

export type NormCoverage = {
  status: keyof typeof normStatusLabels;
  reasons?: string[];
};

export function getNormCoverage(
  positions: PpePosition[],
  norms: PpeNorm[],
  employees: PpeEmployee[],
  today = businessToday(),
): Map<number, NormCoverage> {
  const availableByPosition = new Map<number, PpeNorm[]>();
  for (const norm of norms) {
    const current = availableByPosition.get(norm.positionId) ?? [];
    current.push(norm);
    availableByPosition.set(norm.positionId, current);
  }

  const gendersByPosition = new Map<number, Set<PpeEmployee["gender"]>>();
  for (const employee of employees) {
    if (!employee.isActive) continue;
    const assignments = employee.positionAssignments ?? [
      { positionId: employee.positionId, assignedAt: null },
    ];
    for (const assignment of assignments) {
      if (assignment.assignedAt && assignment.assignedAt > today) continue;
      const genders = gendersByPosition.get(assignment.positionId) ?? new Set();
      genders.add(employee.gender);
      gendersByPosition.set(assignment.positionId, genders);
    }
  }

  return new Map(
    positions.map((position) => {
      const revisions = availableByPosition.get(position.id) ?? [];
      const current = (["MALE", "FEMALE"] as const).flatMap((gender) => {
        const candidates = revisions.filter(
          (norm) =>
            norm.gender === gender &&
            normPeriodStatus(norm, today) !== "Завершённая",
        );
        const effective = candidates.find(
          (norm) => normPeriodStatus(norm, today) === "Действующая",
        );
        const chosen =
          effective ??
          candidates.sort((a, b) =>
            a.effectiveFrom.localeCompare(b.effectiveFrom),
          )[0];
        return chosen ? [chosen] : [];
      });
      const genders = gendersByPosition.get(position.id);
      const effective = current.filter((norm) => norm.effectiveFrom <= today);
      const applicable = genders?.size
        ? current.filter((norm) => genders.has(norm.gender))
        : effective.length
          ? effective
          : current;
      const availableGenders = new Set(
        applicable
          .filter((norm) => norm.items.length > 0)
          .map((norm) => norm.gender),
      );
      const effectiveGenders = new Set(
        applicable
          .filter((norm) => norm.effectiveFrom <= today && norm.items.length > 0)
          .map((norm) => norm.gender),
      );
      const hasEffective = effectiveGenders.size > 0;
      const expired = (["MALE", "FEMALE"] as const).flatMap((gender) => {
        const relevant = genders?.size ? genders.has(gender) : !hasEffective;
        if (
          !relevant ||
          applicable.some(
            (norm) => norm.gender === gender && norm.effectiveFrom <= today,
          )
        )
          return [];
        const latest = revisions
          .filter(
            (norm) =>
              norm.gender === gender &&
              normPeriodStatus(norm, today) === "Завершённая",
          )
          .sort((a, b) => b.effectiveTo!.localeCompare(a.effectiveTo!))[0];
        return latest ? [latest] : [];
      });
      let coverage: NormCoverage;
      if (genders?.has(null)) {
        coverage = {
          status: "partial",
        };
      } else if (!hasEffective && expired.length) {
        coverage = { status: "invalid" };
      } else if (!availableGenders.size) {
        coverage = { status: "missing" };
      } else if (
        genders &&
        [...genders].some((gender) => gender !== null && !availableGenders.has(gender))
      ) {
        coverage = {
          status: "partial",
        };
      } else {
        const futureFrom = applicable
          .filter((norm) => norm.effectiveFrom > today)
          .map((norm) => norm.effectiveFrom)
          .sort()
          .at(-1);
        coverage = {
          status: futureFrom
            ? hasEffective
              ? "partial"
              : "invalid"
            : "complete",
        };
      }
      const reasons: string[] = [];
      if (genders?.has(null)) reasons.push("У части сотрудников не указан пол");
      if (
        genders &&
        [...genders].some((gender) => gender !== null && !availableGenders.has(gender))
      ) {
        reasons.push("Нет подходящей нормы для части сотрудников");
      }
      for (const norm of expired) {
        const gender = norm.gender === "MALE" ? "Мужская" : "Женская";
        reasons.push(
          `${gender} норма завершила действие: ${norm.effectiveTo!.split("-").reverse().join(".")}`,
        );
      }
      for (const norm of applicable) {
        if (norm.effectiveFrom > today) {
          const gender = norm.gender === "MALE" ? "Мужская" : "Женская";
          reasons.push(
            `${gender} норма начнёт действовать: ${norm.effectiveFrom.split("-").reverse().join(".")}`,
          );
        }
      }
      if (coverage.status === "missing" && !reasons.length) {
        reasons.push("Для должности не задана действующая или будущая норма");
      }
      return [
        position.id,
        { ...coverage, ...(reasons.length ? { reasons } : {}) },
      ];
    }),
  );
}
