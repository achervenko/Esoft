import { permissionsForTest } from "../../test/permission-fixtures";
import { NotificationProvider } from "../../shared/ui/notifications/NotificationProvider";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { resolveAppRoute } from "../../layouts/app-router";
import { canAccessWorkspaceRoute } from "../../lib/role-navigation";
import { ppeApi } from "../../shared/api/ppe";
import { PpePage } from "./PpePage";
import { employee } from "./ppe-test-fixtures";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("resolves an employee card URL and allows the PPE specialist", () => {
  expect(resolveAppRoute("#/ppe/positions/2")).toEqual({
    kind: "ppe",
    tab: "norms",
    positionId: 2,
  });
  expect(canAccessWorkspaceRoute(permissionsForTest("ppe_specialist"), "#/ppe/positions/2")).toBe(
    true,
  );
  expect(resolveAppRoute("#/ppe/employees/1")).toEqual({
    kind: "ppe",
    tab: "issue",
    employeeId: 1,
  });
  expect(canAccessWorkspaceRoute(permissionsForTest("ppe_specialist"), "#/ppe/employees/1")).toBe(
    true,
  );
  expect(resolveAppRoute("#/ppe/employees/0")).toEqual({ kind: "unknown" });
});
it("opens a position norms page directly without tabs after reload", async () => {
  vi.spyOn(ppeApi, "employees").mockResolvedValue([]);
  vi.spyOn(ppeApi, "items").mockResolvedValue([]);
  vi.spyOn(ppeApi, "positions").mockResolvedValue([
    { id: 2, name: "Инженер", isActive: true },
  ]);
  vi.spyOn(ppeApi, "norms").mockResolvedValue([]);
  render(
    <PpePage userPermissions={permissionsForTest("ppe_specialist")} initialTab="norms" positionId={2} />,
  );
  await screen.findByRole("heading", { name: "Инженер" });
  expect(
    screen.queryByRole("navigation", { name: "Разделы СИЗ" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Поиск по должностям"),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Назад" })).toBeInTheDocument();
  expect(
    await screen.findByRole("button", { name: "Создать норму" }),
  ).toBeInTheDocument();
});
it("opens the employee directly without tabs or search after reload", async () => {
  const allEmployees = vi.spyOn(ppeApi, "employees").mockResolvedValue([employee]);
  vi.spyOn(ppeApi, "employee").mockResolvedValue(employee);
  vi.spyOn(ppeApi, "items").mockResolvedValue([]);
  vi.spyOn(ppeApi, "positions").mockResolvedValue([]);
  vi.spyOn(ppeApi, "plan").mockResolvedValue({
    employeeId: employee.id,
    employeeName: "Сотрудник",
    positionId: 2,
    position: "Инженер",
    on: "2026-10-06",
    norm: null,
    warnings: [],
    items: [],
  });
  render(
    <NotificationProvider>
      <PpePage userPermissions={permissionsForTest("ppe_specialist")} employeeId={employee.id} />
    </NotificationProvider>,
  );
  await waitFor(() =>
    expect(ppeApi.plan).toHaveBeenCalledWith(
      employee.id,
      undefined,
      expect.any(AbortSignal),
    ),
  );
  expect(
    await screen.findByRole("button", { name: "Назад" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("navigation", { name: "Разделы СИЗ" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Поиск по ФИО")).not.toBeInTheDocument();
  expect(ppeApi.employee).toHaveBeenCalledWith(employee.id, expect.any(AbortSignal));
  expect(allEmployees).not.toHaveBeenCalled();
});
