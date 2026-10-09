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
  const clothing = await screen.findByLabelText("Размер одежды");
  expect(
    screen.getByRole("button", { name: "Сохранить размеры" }),
  ).toBeDisabled();
  fireEvent.change(clothing, { target: { value: "" } });
  fireEvent.change(screen.getByLabelText("Размер обуви"), {
    target: { value: "42.5" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить размеры" }));
  await waitFor(() =>
    expect(ppeApi.employeeSizes).toHaveBeenCalledWith(1, {
      clothingSize: null,
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
  expect(screen.getByText("Ростовка:")).toBeInTheDocument();
  expect(screen.getByText("Размер перчаток:")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Размеры" })).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Отключить" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Добавить" }),
  ).not.toBeInTheDocument();
});
