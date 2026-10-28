import {
  render,
  position,
  warehouse,
  location,
} from "./stock-page-test-context";
import { warehouseStockApi } from "../../shared/api/warehouse-stock-api";
import { useMediaQuery } from "../../shared/lib/useMediaQuery";
import { WarehouseStockPage } from "./WarehouseStockPage";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
const reader = ["warehouse.stock.read"];
it("does not fetch data without stock read permission", () => {
  render(<WarehouseStockPage userPermissions={[]} />);
  expect(
    screen.getByText("Недостаточно прав для просмотра остатков."),
  ).toBeTruthy();
  expect(warehouseStockApi.list).not.toHaveBeenCalled();
  expect(warehouseStockApi.storageLocations).not.toHaveBeenCalled();
});
it("shows one item/warehouse row, exact quantity and distribution without requiring write permission", async () => {
  render(<WarehouseStockPage userPermissions={reader} />);
  await screen.findByText("Подшипник");
  const table = screen.getByRole("table");
  expect(within(table).getAllByRole("row")).toHaveLength(2);
  expect(within(table).getByText("17,001 шт")).toBeTruthy();
  expect(
    within(table).queryByRole("columnheader", { name: "Склад" }),
  ).toBeNull();
  expect(
    within(table).queryByRole("columnheader", { name: "Действия" }),
  ).toBeNull();
  expect(
    within(table).queryByRole("button", { name: /Показать размещение/ }),
  ).toBeNull();
  expect(
    screen.queryByText("Физические остатки включают зарезервированный товар."),
  ).toBeNull();
  expect(screen.queryByRole("button", { name: "Обновить" })).toBeNull();
  expect(screen.queryByRole("combobox", { name: "Склад" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "2 места хранения" }));
  const modal = await screen.findByRole("dialog", {
    name: "Места хранения (Основной склад)",
  });
  await within(modal).findByText(location.name);
  expect(warehouseStockApi.distribution).toHaveBeenCalledWith(
    position.item.id,
    warehouse.id,
    expect.any(AbortSignal),
  );
  expect(
    within(modal).queryByRole("button", { name: "Переместить" }),
  ).toBeNull();
});
it("searches the server, resets paging, sorts and clears search in one action", async () => {
  render(<WarehouseStockPage userPermissions={reader} />);
  await screen.findByText("Подшипник");
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "кабель" },
  });
  await waitFor(() =>
    expect(
      vi.mocked(warehouseStockApi.list).mock.lastCall?.[0].get("search"),
    ).toBe("кабель"),
  );
  expect(vi.mocked(warehouseStockApi.list).mock.lastCall?.[0].get("page")).toBe(
    "1",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Сортировать: Количество" }),
  );
  await waitFor(() =>
    expect(
      vi.mocked(warehouseStockApi.list).mock.lastCall?.[0].get("sortBy"),
    ).toBe("quantity"),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Настройки поиска остатков" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
  await waitFor(() =>
    expect(
      vi.mocked(warehouseStockApi.list).mock.lastCall?.[0].get("search"),
    ).toBe(""),
  );
});
it("limits place choices by selected warehouse and clears place selection when warehouse changes", async () => {
  render(<WarehouseStockPage userPermissions={reader} />);
  await screen.findByText("Подшипник");
  fireEvent.click(
    screen.getByRole("button", { name: "Настройки поиска остатков" }),
  );
  const warehouseSelect = screen.getByRole("combobox", { name: "Склад" });
  await waitFor(() => expect(warehouseSelect).not.toBeDisabled());
  fireEvent.click(warehouseSelect);
  fireEvent.click(await screen.findByRole("option", { name: warehouse.name }));
  await waitFor(() =>
    expect(
      vi.mocked(warehouseStockApi.list).mock.lastCall?.[0].get("warehouseId"),
    ).toBe(warehouse.id),
  );
  await waitFor(() =>
    expect(
      vi
        .mocked(warehouseStockApi.storageLocations)
        .mock.lastCall?.[0].get("warehouseId"),
    ).toBe(warehouse.id),
  );
  const place = screen.getByRole("combobox", { name: "Место хранения" });
  await waitFor(() => expect(place).not.toBeDisabled());
  fireEvent.click(place);
  fireEvent.click(await screen.findByRole("option", { name: location.name }));
  await waitFor(() =>
    expect(
      vi.mocked(warehouseStockApi.list).mock.lastCall?.[0].get("locationId"),
    ).toBe(location.id),
  );
  fireEvent.click(warehouseSelect);
  fireEvent.click(await screen.findByRole("option", { name: "Все склады" }));
  await waitFor(() => {
    const q = vi.mocked(warehouseStockApi.list).mock.lastCall?.[0];
    expect(q?.has("locationId")).toBe(false);
    expect(q?.has("warehouseId")).toBe(false);
  });
});
it("renders mobile cards and keeps an explicit empty state", async () => {
  vi.mocked(useMediaQuery).mockReturnValue(true);
  render(<WarehouseStockPage userPermissions={reader} />);
  const list = await screen.findByRole("list", { name: "Остатки" });
  expect(within(list).getByText("Подшипник")).toBeTruthy();
  expect(screen.queryByRole("table")).toBeNull();
  vi.mocked(warehouseStockApi.list).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    limit: 50,
  });
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "нет товара" },
  });
  await screen.findByText("По вашему запросу остатки не найдены.");
});
it("retains the table when refreshing fails and retries without disappearing", async () => {
  render(<WarehouseStockPage userPermissions={reader} />);
  await screen.findByText("Подшипник");
  const table = screen.getByRole("table");
  vi.mocked(warehouseStockApi.list).mockRejectedValueOnce(
    new Error("Нет связи"),
  );
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "6204" },
  });
  await screen.findByText("Нет связи");
  expect(screen.getByRole("table")).toBe(table);
  fireEvent.click(
    screen.getByRole("button", { name: "Повторить загрузку остатков" }),
  );
  await waitFor(() => expect(screen.queryByText("Нет связи")).toBeNull());
  expect(screen.getByRole("table")).toBe(table);
});

it("loads more groups and restarts from the first page when availability changes", async () => {
  vi.mocked(warehouseStockApi.list).mockImplementation(async (q) => ({
    items: [
      {
        ...position,
        id: q.get("page") === "2" ? "second" : position.id,
        item: {
          ...position.item,
          article: q.get("page") === "2" ? "OTHER" : "6204",
        },
      },
    ],
    total: q.get("quantityState") === "ZERO" ? 1 : 51,
    page: Number(q.get("page")),
    limit: 50,
  }));
  render(<WarehouseStockPage userPermissions={reader} />);
  await screen.findByText("Подшипник");
  fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
  await screen.findByText("OTHER");
  const query = vi.mocked(warehouseStockApi.list).mock.lastCall?.[0];
  expect(query?.get("page")).toBe("2");
  fireEvent.click(
    screen.getByRole("button", { name: "Настройки поиска остатков" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Наличие" }));
  fireEvent.click(
    await screen.findByRole("option", { name: "Только нулевые" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Готово" }));
  await waitFor(() =>
    expect(
      vi.mocked(warehouseStockApi.list).mock.lastCall?.[0].get("page"),
    ).toBe("1"),
  );
  await waitFor(() => expect(screen.queryByText("OTHER")).toBeNull());
  expect(
    vi.mocked(warehouseStockApi.list).mock.lastCall?.[0].get("quantityState"),
  ).toBe("ZERO");
});
