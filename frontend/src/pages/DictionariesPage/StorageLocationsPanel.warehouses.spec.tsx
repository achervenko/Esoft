import { render, item } from "./storage-locations-panel-test-context";
import { warehousesApi } from "../../shared/api/warehouses-api";
import { storageLocationsApi } from "../../shared/api/storage-locations-api";
import { StorageLocationsPanel } from "./StorageLocationsPanel";
import { ConfirmationContext } from "../../shared/ui/confirmation-context";

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { it, expect, vi } from "vitest";

it("creates a warehouse from the parent section", async () => {
  render(<StorageLocationsPanel canManage />);
  fireEvent.click(screen.getByRole("button", { name: "Добавить склад" }));
  const dialog = screen.getByRole("dialog", { name: "Новый склад" });
  fireEvent.change(within(dialog).getByLabelText("Наименование"), {
    target: { value: " Электрики " },
  });
  fireEvent.click(within(dialog).getByText("Сохранить"));
  await waitFor(() =>
    expect(warehousesApi.create).toHaveBeenCalledWith({
      name: "Электрики",
    }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("edits a warehouse without changing the selected warehouse filter", async () => {
  render(<StorageLocationsPanel canManage />);
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Редактировать склад Основной склад",
    }),
  );
  const dialog = screen.getByRole("dialog", { name: "Изменить склад" });
  fireEvent.change(within(dialog).getByLabelText("Наименование"), {
    target: { value: "Главный" },
  });
  fireEvent.click(within(dialog).getByText("Сохранить"));
  await waitFor(() =>
    expect(warehousesApi.update).toHaveBeenCalledWith("1", {
      name: "Главный",
    }),
  );
  expect(
    vi.mocked(storageLocationsApi.list).mock.lastCall?.[0].has("warehouseId"),
  ).toBe(false);
});

it("hides a deleted warehouse and resets its selected scope", async () => {
  let deleted = false;
  vi.mocked(warehousesApi.list).mockImplementation(async () => ({
    items: deleted ? [] : [item.warehouse],
    total: deleted ? 0 : 1,
    page: 1,
    limit: 50,
  }));
  vi.mocked(warehousesApi.update).mockImplementation(async () => {
    deleted = true;
    return { ...item.warehouse, isActive: false };
  });
  const confirm = vi.fn().mockResolvedValue(true);
  render(
    <ConfirmationContext.Provider value={confirm}>
      <StorageLocationsPanel canManage />
    </ConfirmationContext.Provider>,
  );
  const tables = await screen.findAllByRole("table");
  fireEvent.click(within(tables[0]).getByText("Основной склад"));
  await waitFor(() =>
    expect(
      vi.mocked(storageLocationsApi.list).mock.lastCall?.[0].get("warehouseId"),
    ).toBe("1"),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Удалить склад Основной склад" }),
  );
  await waitFor(() =>
    expect(warehousesApi.update).toHaveBeenCalledWith("1", { isActive: false }),
  );
  await waitFor(() =>
    expect(
      vi.mocked(storageLocationsApi.list).mock.lastCall?.[0].has("warehouseId"),
    ).toBe(false),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Удалить склад Основной склад" }),
    ).toBeNull(),
  );
});

it("keeps the warehouse visible when deletion is rejected by the backend", async () => {
  vi.mocked(warehousesApi.update).mockRejectedValue(
    new Error("Сначала деактивируйте места хранения этого склада."),
  );
  render(
    <ConfirmationContext.Provider value={vi.fn().mockResolvedValue(true)}>
      <StorageLocationsPanel canManage />
    </ConfirmationContext.Provider>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Удалить склад Основной склад" }),
  );
  await screen.findByText("Сначала деактивируйте места хранения этого склада.");
  expect(
    screen.getByRole("button", { name: "Удалить склад Основной склад" }),
  ).not.toBeDisabled();
});
