import { describe, expect, it } from "vitest";
import { availableSearchModules, permittedModuleFilter } from "./search-modules";
describe("search modules", () => {
  it.each([
    ["admin", ["equipment", "ppe"]],
    ["chief_engineer", ["equipment"]],
    ["engineer", ["equipment"]],
    ["operator", ["equipment"]],
    ["auditor", ["equipment"]],
    ["ppe_specialist", ["ppe"]],
    ["accounting_specialist", ["ppe"]],
    ["unknown", []],
  ])("uses permissions for %s", (role, expected) => {
    expect(availableSearchModules(role).map(module => module.id)).toEqual(expected);
  });
  it("normalizes selected modules within permitted scope", () => {
    expect(permittedModuleFilter("ppe", "admin")).toBe("ppe");
    expect(permittedModuleFilter("ppe,equipment", "admin")).toBe("");
    expect(permittedModuleFilter("equipment", "ppe_specialist")).toBe("");
    expect(permittedModuleFilter("ppe", "ppe_specialist")).toBe("");
  });
});
