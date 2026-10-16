import { describe, expect, it } from "vitest";
import {
  canIssuePpe,
  canManageEmployeeSizes,
  canManagePpeCatalog,
  canManagePpeNorms,
  canReadPpe,
  canBackdatePpeIssue,
} from "./ppe-permissions";

describe.each([
  { name: "read", check: canReadPpe },
  { name: "manageCatalog", check: canManagePpeCatalog },
  { name: "manageEmployeeSizes", check: canManageEmployeeSizes },
  { name: "manageNorms", check: canManagePpeNorms },
  { name: "issue", check: canIssuePpe },
])("PPE permission $name", ({ check }) => {
  it.each(["admin", "ppe_specialist"])("allows %s", (role) => {
    expect(check(role)).toBe(role === "admin" || (check !== canIssuePpe && check !== canManagePpeCatalog));
  });

  it.each([
    "chief_engineer",
    "engineer",
    "operator",
    "auditor",
    "unknown",
    null,
    undefined,
    true,
    1,
  ])("denies %s", (role) => {
    expect(check(role)).toBe(false);
  });
});

it("restricts manually selected PPE dates to admin", () => {
  expect(canBackdatePpeIssue("admin")).toBe(true);
  for (const role of ["ppe_specialist", "operator", "unknown", null])
    expect(canBackdatePpeIssue(role)).toBe(false);
});
it("allows accounting issuance and catalog but denies sizes, norm changes and backdating", () => {
  expect(canReadPpe("accounting_specialist")).toBe(true);
  expect(canManagePpeCatalog("accounting_specialist")).toBe(true);
  expect(canIssuePpe("accounting_specialist")).toBe(true);
  expect(canManageEmployeeSizes("accounting_specialist")).toBe(false);
  expect(canManagePpeNorms("accounting_specialist")).toBe(false);
  expect(canBackdatePpeIssue("accounting_specialist")).toBe(false);
});
