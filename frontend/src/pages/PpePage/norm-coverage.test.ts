import { expect, it } from "vitest";
import { employee, norm } from "./ppe-test-fixtures";
import { getNormCoverage } from "./norm-coverage";
import type { PpeEmployee, PpeNorm } from "../../shared/api/ppe";

const today = "2026-10-23";
const positions = [
  { id: norm.positionId, name: norm.position, isActive: true },
];
const male = {
  ...employee,
  positionId: norm.positionId,
  gender: "MALE" as const,
};
const female = { ...male, id: 2, gender: "FEMALE" as const };
const active = {
  ...norm,
  gender: "MALE" as const,
  effectiveFrom: "2020-01-01",
  effectiveTo: null,
};
const future = { ...active, effectiveFrom: "2027-01-01" };
const coverage = (norms: PpeNorm[], employees: PpeEmployee[] = [male]) =>
  getNormCoverage(positions, norms, employees, today).get(norm.positionId)!;

it("only requires genders present among active employees", () => {
  expect(
    coverage([active], [male, { ...female, isActive: false }]).status,
  ).toBe("complete");
  expect(coverage([active], [male, female])).toMatchObject({
    status: "partial",
    reasons: ["Нет подходящей нормы для части сотрудников"],
  });
  expect(coverage([active], [female]).status).toBe("missing");
});

it("marks expired and future norms as invalid with their dates", () => {
  expect(coverage([{ ...active, effectiveTo: "2026-10-22" }]).status).toBe(
    "invalid",
  );
  expect(coverage([future])).toMatchObject({
    status: "invalid",
    reasons: ["Мужская норма начнёт действовать: 01.01.2027"],
  });
  expect(coverage([future], [male, female]).status).toBe("partial");
});

it("prefers effective norms to future revisions and otherwise chooses the nearest future", () => {
  const later = { ...future, effectiveFrom: "2028-01-01", items: [] };
  expect(coverage([later, future, active])).toMatchObject({
    status: "complete",
  });
  expect(coverage([later, future]).status).toBe("invalid");
  expect(coverage([later, future, active]).reasons).toBeUndefined();
});

it("includes current additional assignments and excludes future primary and additional ones", () => {
  const assigned = {
    ...female,
    positionId: 999,
    positionAssignments: [
      { positionId: 999, assignedAt: null },
      { positionId: norm.positionId, assignedAt: today },
    ],
  };
  expect(coverage([active], [male, assigned]).status).toBe("partial");
  expect(
    coverage(
      [active],
      [
        male,
        {
          ...assigned,
          positionAssignments: [
            { positionId: norm.positionId, assignedAt: "2026-10-24" },
          ],
        },
      ],
    ).status,
  ).toBe("complete");
});

it("evaluates occupied and vacant positions by available norms", () => {
  const both = [active, { ...active, id: 88, gender: "FEMALE" as const }];
  expect(coverage(both, [male, female]).status).toBe("complete");
  expect(coverage(both, []).status).toBe("complete");
  expect(coverage([], []).status).toBe("missing");
});

it("does not treat unknown gender or an empty norm as full coverage", () => {
  expect(coverage([active], [{ ...male, gender: null }]).status).toBe(
    "partial",
  );
  expect(coverage([{ ...active, items: [] }]).status).toBe("missing");
});

it("does not require future norms for unused genders on a vacant position", () => {
  expect(coverage([active, { ...future, gender: "FEMALE" }], []).status).toBe(
    "complete",
  );
});

it("keeps multiple independent coverage reasons", () => {
  const result = coverage(
    [future],
    [male, female, { ...male, id: 3, gender: null }],
  );
  expect(result.reasons).toEqual([
    "У части сотрудников не указан пол",
    "Нет подходящей нормы для части сотрудников",
    "Мужская норма начнёт действовать: 01.01.2027",
  ]);
});

it("explains a gap between an expired norm and its future successor", () => {
  const expired = { ...active, effectiveTo: "2026-10-22" };
  expect(coverage([expired, future])).toMatchObject({
    status: "invalid",
    reasons: [
      "Мужская норма завершила действие: 22.10.2026",
      "Мужская норма начнёт действовать: 01.01.2027",
    ],
  });
  expect(
    coverage([expired, { ...active, id: 99, effectiveFrom: today }]).status,
  ).toBe("complete");
});

it("uses only the latest end date and excludes expired norms for irrelevant genders", () => {
  const expired = { ...active, effectiveTo: "2026-10-22" };
  const older = { ...expired, id: 77, effectiveTo: "2026-01-01" };
  expect(coverage([expired, older]).reasons).toContain(
    "Мужская норма завершила действие: 22.10.2026",
  );
  expect(
    coverage([expired, older]).reasons?.some((reason) =>
      reason.includes("01.01.2026"),
    ),
  ).toBe(false);
  expect(coverage([expired], [female]).status).toBe("missing");
  expect(coverage([expired], []).status).toBe("invalid");
  expect(coverage([active, { ...expired, gender: "FEMALE" }], []).status).toBe(
    "complete",
  );
});

it("keeps partial coverage when only some employees have an effective norm", () => {
  expect(
    coverage(
      [active, { ...active, gender: "FEMALE", effectiveTo: "2026-10-22" }],
      [male, female],
    ).status,
  ).toBe("partial");
});
