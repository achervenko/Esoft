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
  ["unknown", "#/profile"],
  [null, "#/profile"],
  [undefined, "#/profile"],
] as const)("links to an accessible fallback for %s", (role, expected) => {
  render(<AppShell route="#/ppe/invalid" user={{ role }} onLogout={vi.fn()} />);
  const link = screen.getByRole("link", { name: "Перейти в доступный раздел" });
  expect(link).toHaveAttribute("href", expected);
  expect(canAccessWorkspaceRoute(role, expected)).toBe(true);
});
it("does not mount or fetch a forbidden module even when AppShell receives a direct route", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  render(
    <AppShell
      route="#/equipment"
      user={{ role: "ppe_specialist" }}
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
      user={{ id: "current", role: "admin" }}
      onLogout={vi.fn()}
    />,
  );
  expect(await screen.findByText("Current user: current")).toBeInTheDocument();
});
