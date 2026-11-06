import { expect, it } from "vitest";
import { resolveAppRoute } from "./app-router";
import { canAccessWorkspaceRoute } from "../lib/role-navigation";
it("keeps bigint receipt IDs as strings", () => {
  expect(resolveAppRoute("#/warehouse/receipts/9007199254740995")).toEqual({
    kind: "warehouse-receipts",
    receiptId: "9007199254740995",
  });
  expect(resolveAppRoute("#/warehouse/receipts/new")).toEqual({
    kind: "warehouse-receipts",
    creating: true,
  });
  expect(resolveAppRoute("#/warehouse/receipts/9223372036854775808")).toEqual({
    kind: "unknown",
  });
});
it("guards receipt routes by read/manage permissions", () => {
  expect(canAccessWorkspaceRoute([], "#/warehouse/receipts")).toBe(false);
  expect(
    canAccessWorkspaceRoute(
      ["warehouse.receipts.read"],
      "#/warehouse/receipts/1",
    ),
  ).toBe(true);
  expect(
    canAccessWorkspaceRoute(
      ["warehouse.receipts.read"],
      "#/warehouse/receipts/new",
    ),
  ).toBe(false);
  expect(
    canAccessWorkspaceRoute(
      ["warehouse.receipts.read", "warehouse.receipts.manage"],
      "#/warehouse/receipts/new",
    ),
  ).toBe(true);
});
