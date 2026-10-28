import { render, item } from "./storage-locations-panel-test-context";
import { warehousesApi } from "../../shared/api/warehouses-api";
import { storageLocationsApi } from "../../shared/api/storage-locations-api";
import { StorageLocationsPanel } from "./StorageLocationsPanel";
import { ConfirmationContext } from "../../shared/ui/confirmation-context";

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { it, expect, vi } from "vitest";

it.each([50, 0])(
  "starts the accumulated list over after deactivation reduces total to %i",
  async (remainingTotal) => {
    let total = 51;
    const first = { ...item, id: "1", name: "Первая полка" };
    const pages: string[] = [];
    vi.mocked(storageLocationsApi.list).mockImplementation(async (query) => {
      const page = query.get("page")!;
      pages.push(page);
      return {
        items: total > 0 ? [page === "1" ? first : item] : [],
        total,
        page: Number(page),
        limit: 50,
      };
    });
    vi.mocked(storageLocationsApi.update).mockImplementationOnce(async () => {
      total = remainingTotal;
      return { ...item, isActive: false };
    });
    render(
      <ConfirmationContext.Provider value={vi.fn().mockResolvedValue(true)}>
        <StorageLocationsPanel canManage />
      </ConfirmationContext.Provider>,
    );
    await screen.findByText("Первая полка");
    fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
    await screen.findByText("Полка");
    expect(screen.getByText("Первая полка")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Удалить место Полка" }),
    );
    await waitFor(() => expect(pages.slice(-2)).toEqual(["2", "1"]));
    if (remainingTotal) await screen.findByText("Первая полка");
    else expect(screen.queryByText("Места хранения не найдены.")).toBeNull();
    expect(screen.queryByText("Полка")).toBeNull();
    expect(screen.queryByRole("button", { name: "Показать ещё" })).toBeNull();
  },
);

it("keeps the read-only list usable and sends filters", async () => {
  render(<StorageLocationsPanel canManage={false} />);
  await screen.findByText("Полка");
  expect(screen.queryByRole("button", { name: "Добавить место" })).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Редактировать место A-01" }),
  ).toBeNull();
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(screen.queryByRole("switch")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Удалить склад Основной склад" }),
  ).toBeNull();
  expect(vi.mocked(warehousesApi.list).mock.lastCall?.[0].get("isActive")).toBe(
    "true",
  );
  expect(
    vi.mocked(storageLocationsApi.list).mock.lastCall?.[0].get("isActive"),
  ).toBe("true");
  fireEvent.change(screen.getByLabelText("Поиск складов и мест хранения"), {
    target: { value: "пол" },
  });
  await waitFor(() =>
    expect(
      vi.mocked(storageLocationsApi.list).mock.lastCall?.[0].get("search"),
    ).toBe("пол"),
  );
});

it("retries list errors without showing them in the form", async () => {
  vi.mocked(storageLocationsApi.list).mockRejectedValueOnce(
    new Error("Список недоступен"),
  );
  render(<StorageLocationsPanel canManage />);
  await screen.findByText("Список недоступен");
  fireEvent.click(screen.getByRole("button", { name: "Добавить место" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).queryByText("Список недоступен")).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "Отмена" }));
  fireEvent.click(screen.getByRole("button", { name: "Повторить загрузку" }));
  await screen.findByText("Полка");
  expect(screen.queryByText("Список недоступен")).toBeNull();
});

it("shows name-only warehouse and location columns", async () => {
  render(<StorageLocationsPanel canManage />);
  await screen.findByText("Полка");
  const tables = screen.getAllByRole("table");
  expect(within(tables[0]).getAllByRole("columnheader")).toHaveLength(2);
  expect(within(tables[1]).getAllByRole("columnheader")).toHaveLength(3);
  expect(
    within(tables[1])
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent),
  ).toEqual(["Место хранения", "Склад", ""]);
  expect(
    within(tables[1]).queryByRole("button", { name: "Сортировать: Склад" }),
  ).toBeNull();
  const cells = within(within(tables[1]).getAllByRole("row")[1]).getAllByRole(
    "cell",
  );
  expect(cells[0]).toHaveTextContent(item.name);
  expect(cells[1]).toHaveTextContent(item.warehouse.name);
  expect(
    screen.getByRole("searchbox", { name: "Поиск складов и мест хранения" }),
  ).toBeTruthy();
});

it("places the global search and add warehouse button in the same shared toolbar", async () => {
  render(<StorageLocationsPanel canManage />);
  const search = screen.getByRole("searchbox", {
    name: "Поиск складов и мест хранения",
  });
  const toolbar = search.closest(".search-toolbar");
  expect(toolbar).toHaveClass("search-toolbar-with-action");
  expect(
    within(toolbar as HTMLElement).getByRole("button", {
      name: "Добавить склад",
    }),
  ).toBeTruthy();
  expect(
    screen.getAllByRole("button", { name: "Добавить склад" }),
  ).toHaveLength(1);
  await screen.findByText("Полка");
});

it("toggles server sorting by location name without enabling warehouse sorting", async () => {
  render(<StorageLocationsPanel canManage={false} />);
  await screen.findByText("Полка");
  const heading = screen.getByRole("button", {
    name: "Сортировать: Место хранения",
  });
  fireEvent.click(heading);
  await waitFor(() => {
    const query = vi.mocked(storageLocationsApi.list).mock.lastCall?.[0];
    expect(query?.get("sortBy")).toBe("name");
    expect(query?.get("sortOrder")).toBe("desc");
    expect(query?.get("page")).toBe("1");
  });
  fireEvent.click(heading);
  await waitFor(() =>
    expect(
      vi.mocked(storageLocationsApi.list).mock.lastCall?.[0].get("sortOrder"),
    ).toBe("asc"),
  );
  const locationTable = screen.getAllByRole("table")[1];
  expect(
    within(locationTable).queryByRole("button", { name: "Сортировать: Склад" }),
  ).toBeNull();
});
