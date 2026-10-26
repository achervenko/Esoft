import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
vi.mock("../modules/sidebar", () => ({ Sidebar: () => <nav>Menu</nav> }));
vi.mock("../pages/WarehouseCatalogPage/WarehouseCatalogPage", () => ({
  WarehouseCatalogPage: ({
    userPermissions,
  }: {
    userPermissions: string[];
  }) => <div>Warehouse catalog: {userPermissions.join(",")}</div>,
}));
afterEach(cleanup);
it("connects the catalog route to its page using effective API permissions", async () => {
  render(
    <AppShell
      route="#/warehouse/catalog?q=bolt"
      user={{ permissions: ["warehouse.catalog.manage"] }}
      onLogout={vi.fn()}
    />,
  );
  expect(
    await screen.findByText("Warehouse catalog: warehouse.catalog.manage"),
  ).toBeTruthy();
});
it("does not mount the catalog for an admin label without its permission", () => {
  render(
    <AppShell
      route="#/warehouse/catalog"
      user={{ role: "admin", permissions: ["users.profile.read"] }}
      onLogout={vi.fn()}
    />,
  );
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.queryByText(/Warehouse catalog:/)).toBeNull();
});
