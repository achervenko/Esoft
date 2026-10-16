import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EmployeeSizesModal } from "./EmployeeSizesModal";
import { PpeEmployeesPanel } from "./PpeEmployeesPanel";
import { ppeApi } from "../../shared/api/ppe";
import { employee } from "../PpePage/ppe-test-fixtures";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("patches only changed size fields and clears empty values as null", async () => {
  vi.spyOn(ppeApi, "employee").mockResolvedValue(employee);
  vi.spyOn(ppeApi, "employeeSizes").mockResolvedValue(employee);
  render(<EmployeeSizesModal id={1} onClose={vi.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Изменить" }));
  const clothing = await screen.findByRole("button", { name: `${employee.ppeSizes!.clothingSize};${employee.ppeSizes!.clothingHeight}` });
  expect(
    screen.getByRole("button", { name: "Сохранить размеры" }),
  ).toBeDisabled();
  fireEvent.click(clothing);
  fireEvent.change(screen.getByLabelText("Размер обуви"), {
    target: { value: "42.5" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить размеры" }));
  await waitFor(() =>
    expect(ppeApi.employeeSizes).toHaveBeenCalledWith(1, {
      clothingSize: null,
      clothingHeight: null,
      shoeSize: 42.5,
    }),
  );
});
it("shows all five dimensions for specialists without employee administrative actions", async () => {
  vi.spyOn(ppeApi, "employees").mockResolvedValue([employee]);
  render(
    <ChakraProvider value={defaultSystem}>
      <PpeEmployeesPanel />
    </ChakraProvider>,
  );
  await screen.findByText("Червенко Алехандро");
  expect(screen.getByText(`${employee.ppeSizes!.clothingSize}; ${employee.ppeSizes!.clothingHeight}`)).toBeInTheDocument();
  expect(screen.queryByText("Ростовка:")).not.toBeInTheDocument();
  expect(screen.getByText("Размер перчаток:")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Изменить" })).toBeInTheDocument();
  expect(screen.queryByText("Действия")).not.toBeInTheDocument();
  fireEvent.contextMenu(screen.getByText("Червенко Алехандро"));
  expect(screen.getByRole("menuitem", { name: "Изменить" })).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Отключить" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Добавить" }),
  ).not.toBeInTheDocument();
});

it("replaces the employee clothing pair with one selected option", async () => {
  vi.spyOn(ppeApi, "employee").mockResolvedValue(employee);
  vi.spyOn(ppeApi, "employeeSizes").mockResolvedValue(employee);
  render(<EmployeeSizesModal id={1} onClose={vi.fn()} />);
  const toggle = await screen.findByRole("button", { name: "Изменить" });
  expect(screen.queryByRole("button", { name: "96–100;182–188" })).not.toBeInTheDocument();
  fireEvent.click(toggle);
  const pair = await screen.findByRole("button", { name: "96–100;182–188" });
  fireEvent.click(pair);
  expect(screen.getByText("96–100; 182–188")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "96–100;182–188" })).not.toBeInTheDocument();
  expect(toggle).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Изменить" }));
  expect(screen.getByRole("button", { name: "96–100;182–188" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Сохранить размеры" }));
  await waitFor(() => expect(ppeApi.employeeSizes).toHaveBeenCalledWith(1, { clothingSize: "96–100", clothingHeight: "182–188" }));
});

it.each([
  { clothingSize: "88–92", clothingHeight: null },
  { clothingSize: null, clothingHeight: "170–176" },
])("does not create an empty grid axis for incomplete clothing fields %j", async (sizes) => {
  vi.spyOn(ppeApi, "employee").mockResolvedValue({ ...employee, ppeSizes: { ...employee.ppeSizes!, ...sizes } });
  render(<EmployeeSizesModal id={1} onClose={vi.fn()} />);
  await screen.findByRole("button", { name: "88–92;170–176" });
  const cells = document.querySelectorAll<HTMLButtonElement>(".ppe-clothing-height-options button");
  expect(cells).toHaveLength(24);
  for (const cell of cells) {
    expect(cell.getAttribute("aria-label")).toMatch(/^.+;.+$/);
    expect(cell).toHaveAttribute("aria-pressed", "false");
  }
  expect(screen.getByRole("button", { name: "Сохранить размеры" })).toBeDisabled();
});

it("edits sizes when the employee has no PPE sizes row", async () => {
  vi.spyOn(ppeApi, "employee").mockResolvedValue({ ...employee, ppeSizes: null });
  vi.spyOn(ppeApi, "employeeSizes").mockResolvedValue(employee);
  render(<EmployeeSizesModal id={1} onClose={vi.fn()} />);
  await screen.findByLabelText("Размер обуви");
  expect(screen.getByRole("button", { name: "Сохранить размеры" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Размер обуви"), { target: { value: "42.5" } });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить размеры" }));
  await waitFor(() => expect(ppeApi.employeeSizes).toHaveBeenCalledWith(1, { shoeSize: 42.5 }));
});
