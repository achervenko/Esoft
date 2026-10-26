import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { WarehouseCatalogPage } from "./WarehouseCatalogPage";
import { warehouseCatalogApi } from "../../shared/api/warehouse-catalog-api";

import type { WarehouseItem } from "../../shared/api/warehouse-catalog-api";
import { ApiRequestError } from "../../shared/api/api-error";
import {
  item,
  permissions,
  confirm,
  renderWarehouse as render,
  openCreate,
  setupWarehouseCatalogTests,
} from "./warehouse-catalog-test-utils";
setupWarehouseCatalogTests();

it("creates trimmed data, prevents double submission and refreshes the list", async () => {
  let finish!: (item: WarehouseItem) => void;
  vi.mocked(warehouseCatalogApi.create).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<WarehouseCatalogPage userPermissions={permissions} />);
  await screen.findByText(item.article);
  const dialog = await openCreate();
  fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));
  fireEvent.submit(
    within(dialog).getByRole("button", { name: "Сохранить" }).closest("form")!,
  );
  expect(warehouseCatalogApi.create).toHaveBeenCalledTimes(1);
  expect(warehouseCatalogApi.create).toHaveBeenCalledWith({
    article: "NEW",
    name: "Новая",
    unit: "шт",
    comment: null,
  });
  expect(
    within(dialog).getByRole("button", { name: "Сохранить" }),
  ).toBeDisabled();
  await act(async () => finish(item));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() =>
    expect(warehouseCatalogApi.list).toHaveBeenCalledTimes(2),
  );
});

it("sends only modified fields with the exact bigint ID and blocks no-op edits", async () => {
  render(<WarehouseCatalogPage userPermissions={permissions} />);
  await screen.findByText(item.article);
  fireEvent.click(screen.getByRole("button", { name: "Изменить" }));
  const dialog = screen.getByRole("dialog");
  expect(
    within(dialog).getByRole("button", { name: "Сохранить" }),
  ).toBeDisabled();
  fireEvent.submit(
    within(dialog).getByRole("button", { name: "Сохранить" }).closest("form")!,
  );
  expect(warehouseCatalogApi.update).not.toHaveBeenCalled();
  fireEvent.change(within(dialog).getByLabelText("Комментарий"), {
    target: { value: " " },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));
  await waitFor(() =>
    expect(warehouseCatalogApi.update).toHaveBeenCalledWith(item.id, {
      comment: null,
    }),
  );
});

it.each([
  [
    "WAREHOUSE_ARTICLE_EXISTS",
    "Номенклатура с таким артикулом уже существует.",
  ],
  [
    "WAREHOUSE_UNIT_IN_USE",
    "Нельзя изменить единицу измерения: позиция уже используется в складских операциях.",
  ],
])(
  "keeps edits and displays %s only inside the form",
  async (code, message) => {
    vi.mocked(warehouseCatalogApi.update).mockRejectedValueOnce(
      new ApiRequestError("Conflict", 409, code),
    );
    render(<WarehouseCatalogPage userPermissions={permissions} />);
    await screen.findByText(item.article);
    fireEvent.click(screen.getByRole("button", { name: "Изменить" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Ед. изм."), {
      target: { value: "м" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));
    await within(dialog).findByText(message);
    expect(within(dialog).getByLabelText("Ед. изм.")).toHaveValue("м");
    expect(screen.getAllByText(message)).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "Повторить загрузку" }),
    ).toBeNull();
    if (code === "WAREHOUSE_ARTICLE_EXISTS")
      expect(within(dialog).getByLabelText("Артикул")).toHaveAttribute(
        "aria-invalid",
        "true",
      );
  },
);

it("keeps a failed create open", async () => {
  vi.mocked(warehouseCatalogApi.create).mockRejectedValueOnce(
    new Error("Сохранение недоступно"),
  );
  render(<WarehouseCatalogPage userPermissions={permissions} />);
  await screen.findByText(item.article);
  const dialog = await openCreate();
  fireEvent.click(within(dialog).getByRole("button", { name: "Сохранить" }));
  await within(dialog).findByText("Сохранение недоступно");
  expect(
    screen.queryByRole("button", { name: "Повторить загрузку" }),
  ).toBeNull();
});

it("toggles status inside edit and keeps unsaved fields when confirmation is cancelled", async () => {
  confirm.mockResolvedValueOnce(false);
  render(<WarehouseCatalogPage userPermissions={permissions} />);
  await screen.findByText(item.article);
  expect(screen.queryByRole("button", { name: "Деактивировать" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Изменить" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Наименование"), {
    target: { value: "Черновик" },
  });
  const toggle = within(dialog).getByRole("switch", {
    name: "Активность номенклатуры",
  });
  expect(toggle).toHaveAttribute("aria-checked", "true");
  fireEvent.click(toggle);
  await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
  expect(warehouseCatalogApi.setStatus).not.toHaveBeenCalled();
  await waitFor(() => expect(toggle).toBeEnabled());
  expect(within(dialog).getByLabelText("Наименование")).toHaveValue("Черновик");
  fireEvent.click(toggle);
  await waitFor(() =>
    expect(warehouseCatalogApi.setStatus).toHaveBeenCalledWith(item.id, false),
  );
  await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "false"));
  expect(within(dialog).getByLabelText("Наименование")).toHaveValue("Черновик");
  expect(warehouseCatalogApi.update).not.toHaveBeenCalled();
});

it("shows status errors inside edit and restores the switch", async () => {
  const inactive = { ...item, isActive: false };
  vi.mocked(warehouseCatalogApi.list).mockResolvedValue({
    items: [inactive],
    total: 1,
    limit: 50,
    offset: 0,
  });
  let reject!: (e: Error) => void;
  vi.mocked(warehouseCatalogApi.setStatus).mockImplementationOnce(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  render(<WarehouseCatalogPage userPermissions={permissions} />);
  await screen.findByText(item.article);
  fireEvent.click(screen.getByRole("button", { name: "Изменить" }));
  const dialog = screen.getByRole("dialog");
  const toggle = within(dialog).getByRole("switch");
  fireEvent.click(toggle);
  expect(confirm).not.toHaveBeenCalled();
  expect(toggle).toBeDisabled();
  expect(warehouseCatalogApi.setStatus).toHaveBeenCalledWith(item.id, true);
  await act(async () => reject(new Error("Статус не сохранён")));
  await within(dialog).findByText("Статус не сохранён");
  expect(toggle).toBeEnabled();
  expect(toggle).toHaveAttribute("aria-checked", "false");
  expect(
    screen.queryByRole("button", { name: "Повторить загрузку" }),
  ).toBeNull();
});
