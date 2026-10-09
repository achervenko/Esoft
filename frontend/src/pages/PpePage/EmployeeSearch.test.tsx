import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EmployeeSearch } from "./EmployeeSearch";
import { employee } from "./ppe-test-fixtures";
afterEach(cleanup);
it("finds FIO words in either order and opens the selected card by keyboard", () => {
  const select = vi.fn();
  render(<EmployeeSearch employees={[employee]} onSelect={select} />);
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "Алехандро Червенко" },
  });
  expect(screen.getAllByRole("option")).toHaveLength(1);
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
  expect(select).toHaveBeenCalledWith(employee.id);
});
it("shows all matching employees and an empty-result message", () => {
  const employees = Array.from({ length: 12 }, (_, i) => ({
    ...employee,
    id: i + 1,
  }));
  render(<EmployeeSearch employees={employees} onSelect={vi.fn()} />);
  const input = screen.getByRole("combobox");
  expect(input).toHaveFocus();
  fireEvent.focus(input);
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  fireEvent.change(input, { target: { value: "Червенко" } });
  expect(screen.getAllByRole("option")).toHaveLength(12);
  fireEvent.change(input, { target: { value: "Несуществующий" } });
  expect(screen.getByRole("status")).toHaveTextContent("Сотрудники не найдены");
});
