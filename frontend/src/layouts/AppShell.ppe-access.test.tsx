import { permissionsForTest } from "../test/permission-fixtures";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { canAccessWorkspaceRoute } from "../lib/role-navigation";
vi.mock("../modules/sidebar", () => ({ Sidebar: () => <nav>Menu</nav> }));
vi.mock("../pages/UsersPage", () => ({
  UsersPage: ({ currentUserId }: { currentUserId?: string }) => (
    <div>Current user: {currentUserId}</div>
  ),
}));
afterEach(cleanup);
it.each([
  ["admin", "#/dashboard"],
  ["chief_engineer", "#/dashboard"],
  ["engineer", "#/dashboard"],
  ["operator", "#/dashboard"],
  ["auditor", "#/dashboard"],
  ["ppe_specialist", "#/ppe"],
  ["accounting_specialist", "#/ppe"],
] as const)("links to an accessible fallback for %s", (role, expected) => {
  render(<AppShell route="#/ppe/invalid" user={{ role, permissions: permissionsForTest(role) }} onLogout={vi.fn()} />);
  const link = screen.getByRole("link", { name: "Перейти в доступный раздел" });
  expect(link).toHaveAttribute("href", expected);
  expect(canAccessWorkspaceRoute(permissionsForTest(role), expected)).toBe(true);
});
it("does not mount or fetch a forbidden module even when AppShell receives a direct route", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  render(
    <AppShell
      route="#/equipment"
      user={{ role: "ppe_specialist", permissions: permissionsForTest("ppe_specialist") }}
      onLogout={vi.fn()}
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("раздел недоступен");
  expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
});
it("passes the current user id to account management", async () => {
  render(
    <AppShell
      route="#/users"
      user={{ id: "current", role: "admin", permissions: permissionsForTest("admin") }}
      onLogout={vi.fn()}
    />,
  );
  expect(await screen.findByText("Current user: current")).toBeInTheDocument();
});

it.each(['unknown', null, undefined])('does not link to inaccessible fallback for %s', role => {
 render(<AppShell route="#/equipment" user={{ role, permissions: [] }} onLogout={vi.fn()} />);
 expect(screen.getByRole('alert')).toBeInTheDocument();
 expect(screen.queryByRole('link', { name: 'Перейти в доступный раздел' })).not.toBeInTheDocument();
});

it('does not infer access from an admin label without API permissions', () => {
 render(<AppShell route="#/users" user={{ role: 'admin', permissions: [] }} onLogout={vi.fn()} />);
 expect(screen.getByRole('alert')).toBeInTheDocument();
 expect(screen.queryByText('Current user:')).not.toBeInTheDocument();
});
