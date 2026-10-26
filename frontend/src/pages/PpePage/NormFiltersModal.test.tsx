import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ppeApi } from "../../shared/api/ppe";
import { permissionsForTest } from "../../test/permission-fixtures";
import { NormsPanel } from "./NormsPanel";
import { employee, item, norm } from "./ppe-test-fixtures";

const positions = [
  { id: 10, name: "Действующая должность", isActive: true },
  { id: 20, name: "Совмещённая должность", isActive: true },
  { id: 30, name: "Будущая должность", isActive: true },
  { id: 40, name: "Пустая должность", isActive: true },
];

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(ppeApi, "norms").mockResolvedValue([
    {
      ...norm,
      positionId: 10,
      gender: "MALE",
      effectiveFrom: "2000-01-01",
      effectiveTo: null,
    },
    {
      ...norm,
      id: 2,
      positionId: 20,
      gender: "MALE",
      effectiveFrom: "2000-01-01",
      effectiveTo: null,
    },
    {
      ...norm,
      id: 3,
      positionId: 30,
      gender: "MALE",
      effectiveFrom: "2999-01-01",
      effectiveTo: null,
    },
  ]);
  vi.spyOn(ppeApi, "employees").mockResolvedValue([
    { ...employee, positionId: 20, gender: "MALE" },
    { ...employee, id: 2, positionId: 20, gender: "FEMALE" },
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function renderNorms() {
  render(
    <ChakraProvider value={defaultSystem}>
      <NormsPanel
        positions={positions}
        items={[item]}
        permissions={permissionsForTest("admin")}
        revision={0}
        onChanged={vi.fn()}
      />
    </ChakraProvider>,
  );
  await screen.findByRole("table");
}

function selectFilter(status: string) {
  fireEvent.click(screen.getByRole("button", { name: "Фильтры" }));
  for (const checkbox of screen.getAllByRole("checkbox")) {
    if ((checkbox as HTMLInputElement).value !== status)
      fireEvent.click(checkbox);
  }
}

it.each([
  ["complete", "Действующая должность"],
  ["partial", "Совмещённая должность"],
  ["invalid", "Будущая должность"],
  ["missing", "Пустая должность"],
])("filters the table by %s after applying", async (status, name) => {
  await renderNorms();
  selectFilter(status);
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(5);
  fireEvent.click(screen.getByRole("button", { name: "Применить" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  const table = screen.getByRole("table");
  expect(within(table).getAllByRole("row")).toHaveLength(2);
  expect(within(table).getByText(name)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Фильтры" })).toHaveClass(
    "search-toolbar-filter-active",
  );
});

it("discards unapplied changes and resets the status without clearing search", async () => {
  await renderNorms();
  selectFilter("complete");
  fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(5);
  selectFilter("complete");
  fireEvent.click(screen.getByRole("button", { name: "Применить" }));
  fireEvent.change(
    screen.getByRole("searchbox", { name: "Поиск по должностям" }),
    { target: { value: "Будущая" } },
  );
  expect(screen.getByText("Ничего не найдено.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Фильтры" }));
  expect(screen.getByRole("checkbox", { name: "Нормы заданы" })).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Сбросить" }));
  fireEvent.click(screen.getByRole("button", { name: "Применить" }));
  expect(
    screen.getByRole("searchbox", { name: "Поиск по должностям" }),
  ).toHaveValue("Будущая");
  expect(screen.getByText("Будущая должность")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Фильтры" })).not.toHaveClass(
    "search-toolbar-filter-active",
  );
});

it("combines several statuses and prevents applying an empty selection", async () => {
  await renderNorms();
  selectFilter("complete");
  fireEvent.click(screen.getByRole("checkbox", { name: "Неполные нормы" }));
  fireEvent.click(screen.getByRole("button", { name: "Применить" }));
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(3);
  expect(screen.getByText("Действующая должность")).toBeInTheDocument();
  expect(screen.getByText("Совмещённая должность")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Фильтры" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Нормы заданы" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Неполные нормы" }));
  expect(screen.getByRole("button", { name: "Применить" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Сбросить" }));
  for (const checkbox of screen.getAllByRole("checkbox"))
    expect(checkbox).toBeChecked();
  expect(screen.getByRole("button", { name: "Применить" })).toBeEnabled();
});
