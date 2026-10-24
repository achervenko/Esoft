import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { EmployeeSizes } from "../../shared/api/ppe";
import { searchApp } from "../../shared/api/search-api";
import { DictionaryEmployeesTable } from "./DictionaryEmployeesTable";
import {
  complete,
  employee,
  mockViewport,
  renderEmployees,
} from "./dictionary-employees-test-helpers";

vi.mock("../../shared/api/search-api", () => ({ searchApp: vi.fn() }));

beforeEach(() => {
  vi.mocked(searchApp).mockReset().mockResolvedValue([]);
  mockViewport();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it.each([
  [null, "missing"],
  [
    {
      ...complete,
      clothingSize: null,
      clothingHeight: null,
      tshirtSize: null,
      tshirtHeight: null,
      shoeSize: null,
      gloveSize: null,
      headwearSize: null,
    },
    "missing",
  ],
  ...(Object.keys(complete) as Array<keyof EmployeeSizes>).map(
    (key) => [{ ...complete, [key]: null }, "partial"] as const,
  ),
  [complete, "complete"],
] as const)("shows the size completeness state for %p", (sizes, status) => {
  const onSizes = vi.fn();
  renderEmployees([employee], {
    onSizes,
    employeeSizes: new Map([[1, sizes]]),
  });
  const dot = screen.queryByRole("img");
  if (status === "complete") expect(dot).toBeNull();
  else expect(dot).toHaveClass("employee-sizes-dot", status);
  fireEvent.click(screen.getByRole("button", { name: /Размеры/ }));
  expect(onSizes).toHaveBeenCalledWith(employee);
});

it("does not mark unloaded sizes as missing and updates when sizes change", () => {
  const props = {
    employees: [employee],
    onEdit: vi.fn(),
    onToggleStatus: vi.fn(),
    onSizes: vi.fn(),
  };
  const { rerender } = renderEmployees(props.employees, props);
  expect(screen.queryByRole("img")).toBeNull();
  rerender(
    <DictionaryEmployeesTable
      {...props}
      employeeSizes={new Map([[1, null]])}
    />,
  );
  expect(screen.getByRole("img")).toHaveClass("missing");
  rerender(
    <DictionaryEmployeesTable
      {...props}
      employeeSizes={new Map([[1, complete]])}
    />,
  );
  expect(screen.queryByRole("img")).toBeNull();
});
