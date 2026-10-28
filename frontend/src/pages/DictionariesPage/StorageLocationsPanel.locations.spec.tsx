import { render, item } from "./storage-locations-panel-test-context";
import { warehousesApi } from "../../shared/api/warehouses-api";
import { storageLocationsApi } from "../../shared/api/storage-locations-api";
import { StorageLocationsPanel } from "./StorageLocationsPanel";
import { ConfirmationContext } from "../../shared/ui/confirmation-context";

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { it, expect, vi } from "vitest";

it("edits only changed fields and preserves bigint ID", async () => {
  render(<StorageLocationsPanel canManage />);
  await screen.findByText("Полка");
  fireEvent.click(screen.getByText("Полка"));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Наименование"), {
    target: { value: "Новая полка" },
  });
  await waitFor(() =>
    expect(within(dialog).getByText("Сохранить")).not.toBeDisabled(),
  );
  await waitFor(() =>
    expect(within(dialog).getByText("Сохранить")).not.toBeDisabled(),
  );
  fireEvent.click(within(dialog).getByText("Сохранить"));
  await waitFor(() =>
    expect(storageLocationsApi.update).toHaveBeenCalledWith(item.id, {
      name: "Новая полка",
    }),
  );
});

it("keeps the form open when create fails", async () => {
  vi.mocked(storageLocationsApi.create).mockRejectedValue(
    new Error("Код уже существует"),
  );
  render(<StorageLocationsPanel canManage />);
  await screen.findByText("Полка");
  fireEvent.click(screen.getByRole("button", { name: "Добавить место" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Наименование"), {
    target: { value: "Другая" },
  });
  await waitFor(() =>
    expect(within(dialog).getByText("Сохранить")).not.toBeDisabled(),
  );
  fireEvent.click(within(dialog).getByText("Сохранить"));
  await within(dialog).findByText("Код уже существует");
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.getAllByText("Код уже существует")).toHaveLength(1);
  expect(
    screen.queryByRole("button", { name: "Повторить загрузку" }),
  ).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "Отмена" }));
  fireEvent.click(screen.getByRole("button", { name: "Добавить место" }));
  expect(screen.queryByText("Код уже существует")).toBeNull();
});

it("shows status operation errors without a list retry button", async () => {
  vi.mocked(storageLocationsApi.get).mockRejectedValueOnce(
    new Error("Не удалось проверить остаток"),
  );
  render(<StorageLocationsPanel canManage />);
  await screen.findByText("Полка");
  fireEvent.click(screen.getByRole("button", { name: "Удалить место Полка" }));
  await screen.findByText("Не удалось проверить остаток");
  expect(
    screen.queryByRole("button", { name: "Повторить загрузку" }),
  ).toBeNull();
  expect(storageLocationsApi.update).not.toHaveBeenCalled();
});

it("does not deactivate when the user cancels the warning", async () => {
  const confirm = vi.fn().mockResolvedValue(false);
  render(
    <ConfirmationContext.Provider value={confirm}>
      <StorageLocationsPanel canManage />
    </ConfirmationContext.Provider>,
  );
  await screen.findByText("Полка");
  fireEvent.click(screen.getByRole("button", { name: "Удалить место Полка" }));
  await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
  expect(storageLocationsApi.update).not.toHaveBeenCalled();
});

it("creates a location with its selected warehouse", async () => {
  render(<StorageLocationsPanel canManage />);
  await screen.findByText("Полка");
  fireEvent.click(screen.getByRole("button", { name: "Добавить место" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Наименование"), {
    target: { value: "Угол ангара" },
  });
  await waitFor(() =>
    expect(within(dialog).getByText("Сохранить")).not.toBeDisabled(),
  );
  fireEvent.click(within(dialog).getByText("Сохранить"));
  await waitFor(() =>
    expect(storageLocationsApi.create).toHaveBeenCalledWith({
      warehouseId: "1",

      name: "Угол ангара",
      isActive: true,
    }),
  );
});

it("blocks location creation when no warehouse is available", async () => {
  vi.mocked(warehousesApi.list).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    limit: 100,
  });
  render(<StorageLocationsPanel canManage />);
  await screen.findByText("Полка");
  await waitFor(() => expect(warehousesApi.list).toHaveBeenCalled());
  expect(screen.queryByText("Склады пока не добавлены.")).toBeNull();
  expect(
    screen.queryByText("Нет активных складов. Сначала создайте склад."),
  ).toBeNull();
  expect(screen.getByRole("button", { name: "Добавить место" })).toBeDisabled();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(storageLocationsApi.create).not.toHaveBeenCalled();
});
