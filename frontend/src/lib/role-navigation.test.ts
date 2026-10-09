import { expect, it } from "vitest";
import {
  canAccessWorkspaceRoute,
  getDefaultAuthRoute,
} from "./role-navigation";

it.each(
  ["ppe_specialist", "accounting_specialist"].flatMap((role) =>
    ["#/ppe/employees/1", "#/ppe/positions/1"].map((route) => [role, route]),
  ),
)("allows %s to access the special PPE route %s", (role, route) => {
  expect(canAccessWorkspaceRoute(role, route)).toBe(true);
});

it.each(
  ["ppe_specialist", "accounting_specialist"].flatMap((role) =>
    ["employees", "positions"].flatMap((resource) =>
      ["0", "-1", "abc"].map((id) => [role, `#/ppe/${resource}/${id}`]),
    ),
  ),
)("rejects %s access to the invalid PPE route %s", (role, route) => {
  expect(canAccessWorkspaceRoute(role, route)).toBe(false);
});

it("allows only PPE, limited employees and profile for PPE specialists", () => {
  for (const path of [
    "#/ppe",
    "#/ppe?tab=journal",
    "#/dictionaries",
    "#/profile",
  ])
    expect(canAccessWorkspaceRoute("ppe_specialist", path)).toBe(true);
  for (const path of [
    "#/dashboard",
    "#/equipment",
    "#/equipment/1",
    "#/calendar",
    "#/search",
    "#/my-checklists",
    "#/users",
    "#/production-calendar",
    "#/ppe-other",
  ])
    expect(canAccessWorkspaceRoute("ppe_specialist", path)).toBe(false);
  expect(getDefaultAuthRoute("ppe_specialist")).toBe("#/ppe");
  expect(getDefaultAuthRoute("admin")).toBe("#/dashboard");
  expect(canAccessWorkspaceRoute("engineer", "#/equipment")).toBe(true);
});
it("keeps the reserved accounting specialist role out of workspace modules", () => {
  expect(getDefaultAuthRoute("accounting_specialist")).toBe("#/ppe");
  expect(canAccessWorkspaceRoute("accounting_specialist", "#/ppe")).toBe(true);
  expect(canAccessWorkspaceRoute("accounting_specialist", "#/profile")).toBe(
    true,
  );
  for (const route of [
    "#/equipment",
    "#/dictionaries",
    "#/users",
    "#/dashboard",
  ])
    expect(canAccessWorkspaceRoute("accounting_specialist", route)).toBe(false);
});
