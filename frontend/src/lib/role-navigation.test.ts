import { permissionsForTest } from "../test/permission-fixtures";
import { expect, it } from "vitest";
import {
  canAccessWorkspaceRoute,
  getDefaultAuthRoute,
} from "./role-navigation";

it("gates the warehouse catalog by its effective permission", () => {
  for (const role of ["admin", "storekeeper"]) {
    expect(
      canAccessWorkspaceRoute(
        permissionsForTest(role),
        "#/warehouse/catalog?q=bolt",
      ),
    ).toBe(true);
  }
  for (const permissions of [
    [],
    ["warehouse.stock.read"],
    ["dictionaries.manage"],
  ]) {
    expect(canAccessWorkspaceRoute(permissions, "#/warehouse/catalog")).toBe(
      false,
    );
  }
  expect(
    canAccessWorkspaceRoute(
      ["warehouse.catalog.manage"],
      "#/warehouse/unknown",
    ),
  ).toBe(false);
});

it("keeps profile as the default route for storekeeper", () => {
  expect(getDefaultAuthRoute(permissionsForTest("storekeeper"))).toBe(
    "#/profile",
  );
  expect(
    canAccessWorkspaceRoute(permissionsForTest("storekeeper"), "#/profile"),
  ).toBe(true);
  for (const route of [
    "#/equipment",
    "#/ppe",
    "#/users",
    "#/calendar",
    "#/dashboard",
    "#/search",
  ])
    expect(
      canAccessWorkspaceRoute(permissionsForTest("storekeeper"), route),
    ).toBe(false);
});

it.each(
  ["ppe_specialist", "accounting_specialist"].flatMap((role) =>
    ["#/ppe/employees/1", "#/ppe/positions/1"].map((route) => [role, route]),
  ),
)("allows %s to access the special PPE route %s", (role, route) => {
  expect(canAccessWorkspaceRoute(permissionsForTest(role), route)).toBe(true);
});

it.each(
  ["ppe_specialist", "accounting_specialist"].flatMap((role) =>
    ["employees", "positions"].flatMap((resource) =>
      ["0", "-1", "abc"].map((id) => [role, `#/ppe/${resource}/${id}`]),
    ),
  ),
)("rejects %s access to the invalid PPE route %s", (role, route) => {
  expect(canAccessWorkspaceRoute(permissionsForTest(role), route)).toBe(false);
});

it("allows only PPE, limited employees and profile for PPE specialists", () => {
  for (const path of [
    "#/ppe",
    "#/ppe?tab=journal",
    "#/search",
    "#/dictionaries",
    "#/profile",
  ])
    expect(
      canAccessWorkspaceRoute(permissionsForTest("ppe_specialist"), path),
    ).toBe(true);
  for (const path of [
    "#/dashboard",
    "#/equipment",
    "#/equipment/1",
    "#/calendar",
    "#/my-checklists",
    "#/users",
    "#/production-calendar",
    "#/ppe-other",
  ])
    expect(
      canAccessWorkspaceRoute(permissionsForTest("ppe_specialist"), path),
    ).toBe(false);
  expect(getDefaultAuthRoute(permissionsForTest("ppe_specialist"))).toBe(
    "#/ppe",
  );
  expect(getDefaultAuthRoute(permissionsForTest("admin"))).toBe("#/dashboard");
  expect(
    canAccessWorkspaceRoute(permissionsForTest("engineer"), "#/equipment"),
  ).toBe(true);
});
it("keeps the reserved accounting specialist role out of workspace modules", () => {
  expect(getDefaultAuthRoute(permissionsForTest("accounting_specialist"))).toBe(
    "#/ppe",
  );
  expect(
    canAccessWorkspaceRoute(
      permissionsForTest("accounting_specialist"),
      "#/search",
    ),
  ).toBe(true);
  expect(
    canAccessWorkspaceRoute(
      permissionsForTest("accounting_specialist"),
      "#/ppe",
    ),
  ).toBe(true);
  expect(
    canAccessWorkspaceRoute(
      permissionsForTest("accounting_specialist"),
      "#/profile",
    ),
  ).toBe(true);
  for (const route of [
    "#/equipment",
    "#/dictionaries",
    "#/users",
    "#/dashboard",
  ])
    expect(
      canAccessWorkspaceRoute(
        permissionsForTest("accounting_specialist"),
        route,
      ),
    ).toBe(false);
});

it.each([
  "#/abc",
  "#/equipment-invalid",
  "#/something",
  "#/equipment/1/edit-anything",
  "#/equipment/1/edit/extra",
  "#/equipment/abc",
  "#/equipment/0",
  "#/equipment/-1",
  "#/users/unknown",
  "#/checklist-admin/unknown",
  "#/my-checklists/unknown",
])(
  "rejects unsupported workspace route %s even with administrative permissions",
  (route) => {
    expect(canAccessWorkspaceRoute(permissionsForTest("admin"), route)).toBe(
      false,
    );
  },
);
it.each([
  "#/equipment",
  "#/equipment/12",
  "#/equipment/12?tab=documents&eventId=3",
])("checks equipment.read for supported route %s", (route) => {
  expect(canAccessWorkspaceRoute(["equipment.read"], route)).toBe(true);
  expect(canAccessWorkspaceRoute([], route)).toBe(false);
});
it.each([
  "#/equipment/create",
  "#/equipment/12/edit",
  "#/equipment/12/edit?tab=documents",
])("requires equipment.edit for route %s", (route) => {
  expect(canAccessWorkspaceRoute(["equipment.read"], route)).toBe(false);
  expect(canAccessWorkspaceRoute(["equipment.edit"], route)).toBe(true);
});

it("stock viewing requires only stock read permission", () => {
  expect(
    canAccessWorkspaceRoute(
      ["warehouse.stock.read"],
      "#/warehouse/stock?warehouseId=1",
    ),
  ).toBe(true);
  expect(
    canAccessWorkspaceRoute(["warehouse.catalog.manage"], "#/warehouse/stock"),
  ).toBe(false);
});
