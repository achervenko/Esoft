import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { searchApp } from "../../shared/api/search-api";
import { DictionaryEmployeesTable } from "./DictionaryEmployeesTable";
import {
  complete,
  employee,
  mobileViewport,
  openEmployeeCard,
  renderEmployees,
} from "./dictionary-employees-test-helpers";

vi.mock("../../shared/api/search-api", () => ({ searchApp: vi.fn() }));

beforeEach(() => {
  vi.mocked(searchApp).mockReset().mockResolvedValue([]);
  mobileViewport();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("shows compact mobile cards and moves details and actions into a modal", () => {
  const onEdit = vi.fn();
  const onSizes = vi.fn();
  const onToggleStatus = vi.fn();
  const item = {
    ...employee,
    gender: "FEMALE" as const,
    additionalPositions: [{ id: 2, name: "Механик" }],
  };
  const props = {
    employees: [item],
    onEdit,
    onSizes,
    onToggleStatus,
    employeeSizes: new Map([[1, complete]]),
  };
  renderEmployees(props.employees, props);
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.queryByRole("switch")).toBeNull();
  expect(screen.queryByRole("button", { name: /Размеры/ })).toBeNull();
  expect(screen.queryByText("Женский")).toBeNull();
  expect(screen.getByText("Инженер, Механик")).toBeInTheDocument();

  openEmployeeCard();
  const dialog = screen.getByRole("dialog", { name: item.fullName });
  expect(within(dialog).getByText("Женский")).toBeInTheDocument();
  expect(within(dialog).getByText("Размер обуви")).toBeInTheDocument();
  expect(within(dialog).getByText("42")).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("switch"));
  expect(onToggleStatus).toHaveBeenCalledWith(item);
  fireEvent.click(within(dialog).getByRole("button", { name: /Размеры/ }));
  expect(onSizes).toHaveBeenCalledWith(item);
  expect(screen.queryByRole("dialog")).toBeNull();
  openEmployeeCard();
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: /Редактировать сотрудника/,
    }),
  );
  expect(onEdit).toHaveBeenCalledWith(item);
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("keeps self-deactivation blocked and hides size actions without permission on mobile", () => {
  renderEmployees([{ ...employee, isLinkedToCurrentUser: true }]);
  openEmployeeCard();
  expect(screen.getByRole("switch")).toBeDisabled();
  expect(screen.queryByRole("button", { name: /Размеры/ })).toBeNull();
});

it("refreshes the selected employee details and preserves active-first alphabetical order", () => {
  const props = {
    employees: [
      { ...employee, id: 3, fullName: "Яков", isActive: false },
      { ...employee, id: 2, fullName: "Борис" },
      { ...employee, fullName: "Анна" },
    ],
    onEdit: vi.fn(),
    onToggleStatus: vi.fn(),
  };
  const { rerender } = renderEmployees(props.employees, props);
  expect(
    screen.getAllByRole("button").map((button) => button.textContent),
  ).toEqual(["АннаИнженер", "БорисИнженер", "ЯковИнженер"]);
  openEmployeeCard("Анна");
  rerender(
    <DictionaryEmployeesTable
      {...props}
      employees={props.employees.map((item) =>
        item.id === 1 ? { ...item, gender: "FEMALE", isActive: false } : item,
      )}
    />,
  );
  expect(
    within(screen.getByRole("dialog")).getByText("Женский"),
  ).toBeInTheDocument();
  expect(screen.getByRole("switch")).not.toBeChecked();
});
