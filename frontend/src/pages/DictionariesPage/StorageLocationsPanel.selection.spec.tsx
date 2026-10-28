import { render, item } from "./storage-locations-panel-test-context";
import { warehousesApi } from "../../shared/api/warehouses-api";
import { storageLocationsApi } from "../../shared/api/storage-locations-api";
import { StorageLocationsPanel } from "./StorageLocationsPanel";

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { it, expect, vi } from "vitest";

it("filters places by warehouse and preselects it when creating a place", async () => {
  const second = { id: "2", name: "Электрики", isActive: true };
  vi.mocked(warehousesApi.list).mockResolvedValue({
    items: [item.warehouse, second],
    total: 2,
    page: 1,
    limit: 50,
  });
  render(<StorageLocationsPanel canManage />);
  fireEvent.click(await screen.findByText("Электрики"));
  await waitFor(() =>
    expect(
      vi.mocked(storageLocationsApi.list).mock.lastCall?.[0].get("warehouseId"),
    ).toBe("2"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Добавить место" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Наименование"), {
    target: { value: "Ящик" },
  });
  await waitFor(() =>
    expect(within(dialog).getByText("Сохранить")).not.toBeDisabled(),
  );
  fireEvent.click(within(dialog).getByText("Сохранить"));
  await waitFor(() =>
    expect(storageLocationsApi.create).toHaveBeenCalledWith({
      warehouseId: "2",

      name: "Ящик",
      isActive: true,
    }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.queryByRole("button", { name: "Все склады" })).toBeNull();
  const parentSection = screen.getByRole("region", { name: "Склады" });
  fireEvent.click(await within(parentSection).findByText("Электрики"));
  await waitFor(() =>
    expect(
      vi.mocked(storageLocationsApi.list).mock.lastCall?.[0].has("warehouseId"),
    ).toBe(false),
  );
});

it("searches both dictionaries from the toolbar above the sections and resets warehouse scope", async () => {
  render(<StorageLocationsPanel canManage={false} />);
  const tables = await screen.findAllByRole("table");
  const warehouseRow = within(tables[0]).getByText("Основной склад");
  fireEvent.click(warehouseRow);
  await waitFor(() =>
    expect(
      vi.mocked(storageLocationsApi.list).mock.lastCall?.[0].get("warehouseId"),
    ).toBe("1"),
  );
  const search = screen.getByRole("searchbox", {
    name: "Поиск складов и мест хранения",
  });
  expect(
    search.compareDocumentPosition(
      screen.getByRole("heading", { name: "Склады" }),
    ) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  fireEvent.change(search, { target: { value: "пол" } });
  await waitFor(() => {
    expect(vi.mocked(warehousesApi.list).mock.lastCall?.[0].get("search")).toBe(
      "пол",
    );
    expect(
      vi.mocked(storageLocationsApi.list).mock.lastCall?.[0].get("search"),
    ).toBe("пол");
    expect(
      vi.mocked(storageLocationsApi.list).mock.lastCall?.[0].has("warehouseId"),
    ).toBe(false);
  });
});
