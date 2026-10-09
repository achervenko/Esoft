import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ppeApi } from "../../shared/api/ppe";
import { PpePage } from "./PpePage";
import { item, issue } from "./ppe-test-fixtures";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("loads and refreshes the catalog without loading employees or positions", async () => {
  const items = vi.spyOn(ppeApi, "items").mockResolvedValue([item]);
  const employees = vi
    .spyOn(ppeApi, "employees")
    .mockRejectedValue(new Error("offline"));
  const positions = vi
    .spyOn(ppeApi, "positions")
    .mockRejectedValue(new Error("offline"));
  vi.spyOn(ppeApi, "saveItem").mockResolvedValue(item);
  render(
    <ChakraProvider value={defaultSystem}>
      <PpePage userRole="admin" initialTab="catalog" />
    </ChakraProvider>,
  );
  await screen.findByLabelText("Поиск по номенклатуре");
  expect(employees).not.toHaveBeenCalled();
  expect(positions).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Добавить СИЗ" }));
  fireEvent.change(screen.getByLabelText("Артикул"), {
    target: { value: "C-2" },
  });
  fireEvent.change(screen.getByLabelText("Наименование"), {
    target: { value: "Костюм" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await waitFor(() => expect(items).toHaveBeenCalledTimes(2));
  expect(employees).not.toHaveBeenCalled();
  expect(positions).not.toHaveBeenCalled();
});

it("keeps journal rows visible when a filter reference fails", async () => {
  const items = vi
    .spyOn(ppeApi, "items")
    .mockRejectedValue(new Error("offline"));
  vi.spyOn(ppeApi, "employees").mockResolvedValue([]);
  vi.spyOn(ppeApi, "positions").mockResolvedValue([]);
  vi.spyOn(ppeApi, "journal").mockResolvedValue([issue]);
  render(
    <ChakraProvider value={defaultSystem}>
      <PpePage userRole="admin" initialTab="journal" />
    </ChakraProvider>,
  );
  await screen.findByRole("table");
  expect(items).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Фильтры" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("table")).toBeInTheDocument();
  expect(screen.queryByText("Загрузка...")).not.toBeInTheDocument();
});
