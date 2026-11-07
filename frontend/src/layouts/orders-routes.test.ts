import { expect, it } from "vitest";
import { resolveAppRoute } from "./app-router";
import { canAccessWorkspaceRoute } from "../lib/role-navigation";
it("routes the independent order directory and UUID card using order permissions", () => {
  const id = "8f23444c-b5ab-11f1-9606-40a8f031fdf3";
  expect(resolveAppRoute("#/orders")).toEqual({ kind: "orders" });
  expect(resolveAppRoute(`#/orders/${id}`)).toEqual({
    kind: "orders",
    orderId: id,
  });
  expect(resolveAppRoute("#/orders/not-id")).toEqual({ kind: "unknown" });
  expect(canAccessWorkspaceRoute(["orders.read"], `#/orders/${id}`)).toBe(true);
  expect(canAccessWorkspaceRoute(["warehouse.projects.read"], "#/orders")).toBe(
    false,
  );
});
