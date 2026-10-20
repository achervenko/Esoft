import {
  cleanup,
  fireEvent,
  render as renderComponent,
  screen,
} from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { EmployeeSizes } from "../../shared/api/ppe";
import type { AdminEmployee } from "../../shared/api/users-admin-api";
import { DictionaryEmployeesTable } from "./DictionaryEmployeesTable";

beforeEach(() =>
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true })),
  ),
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const render = (ui: ReactElement) =>
  renderComponent(ui, {
    wrapper: ({ children }) => (
      <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
    ),
  });
const employee = {
  id: 1,
  fullName: "Иван Иванов",
  position: "Инженер",
  isActive: true,
} as AdminEmployee;
const complete: EmployeeSizes = {
  clothingSize: "48",
  clothingHeight: "176",
  tshirtSize: "48",
  tshirtHeight: "176",
  shoeSize: 42,
  gloveSize: "9",
  headwearSize: "58",
};

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
  ...Object.keys(complete).map(
    (key) => [{ ...complete, [key]: null }, "partial"] as const,
  ),
  [complete, "complete"],
] as const)("shows the size completeness state for %p", (sizes, status) => {
  const onSizes = vi.fn();
  render(
    <DictionaryEmployeesTable
      employees={[employee]}
      onEdit={vi.fn()}
      onToggleStatus={vi.fn()}
      onSizes={onSizes}
      employeeSizes={new Map([[1, sizes]])}
    />,
  );
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
  const { rerender } = render(<DictionaryEmployeesTable {...props} />);
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
