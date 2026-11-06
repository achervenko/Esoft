import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { render } from "./receipts-test-render";
import { ReceiptManualForm } from "./ReceiptManualForm";
import { receiptsApi } from "../../shared/api/warehouse-receipts-api";
import { warehouseCatalogApi } from "../../shared/api/warehouse-catalog-api";
import { receipt } from "./receipts-test-context";
vi.mock("../../shared/api/warehouse-receipts-api", () => ({
  receiptsApi: { create: vi.fn() },
}));
vi.mock("../../shared/api/warehouse-catalog-api", () => ({
  warehouseCatalogApi: { list: vi.fn(), create: vi.fn() },
}));
vi.mock("./useReceiptStorage", () => ({
  useReceiptStorage: () => ({
    warehouses: [{ id: "4", name: "Склад" }],
    error: null,
  }),
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(warehouseCatalogApi.list).mockResolvedValue({
    items: [],
    total: 0,
    offset: 0,
    limit: 100,
  });
  vi.mocked(receiptsApi.create).mockResolvedValue(receipt);
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});
it("does not create anything when the new item dialog is cancelled", async () => {
  render(
    <ReceiptManualForm
      actorId="actor"
      canCreateItems
      onCreated={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByRole("combobox", { name: "Номенклатура" }), {
    target: { value: "UNIQUE" },
  });
  fireEvent.click(
    await screen.findByRole("button", { name: "Создать номенклатуру" }),
  );
  const dialog = within(
    screen.getByRole("dialog", { name: "Новая номенклатура" }),
  );
  fireEvent.change(dialog.getByLabelText("Артикул"), {
    target: { value: "UNSAVED" },
  });
  fireEvent.click(dialog.getByRole("button", { name: "Отмена" }));
  expect(
    screen.queryByRole("dialog", { name: "Новая номенклатура" }),
  ).not.toBeInTheDocument();
  expect(warehouseCatalogApi.create).not.toHaveBeenCalled();
  expect(receiptsApi.create).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Создать приход" })).toBeDisabled();
});
it("keeps new items in the form and sends them only with the receipt", async () => {
  render(
    <ReceiptManualForm
      actorId="actor"
      canCreateItems
      onCreated={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByRole("combobox", { name: "Номенклатура" }), {
    target: { value: "UNIQUE" },
  });
  fireEvent.click(
    await screen.findByRole("button", { name: "Создать номенклатуру" }),
  );
  const dialog = within(
    screen.getByRole("dialog", { name: "Новая номенклатура" }),
  );
  fireEvent.change(dialog.getByLabelText("Артикул"), {
    target: { value: "NEW-1" },
  });
  fireEvent.change(dialog.getByLabelText("Название"), {
    target: { value: "Новый товар" },
  });
  fireEvent.change(dialog.getByLabelText("Единица измерения"), {
    target: { value: "кг" },
  });
  await waitFor(() =>
    expect(
      dialog.getByRole("button", { name: "Добавить в приход" }),
    ).toBeEnabled(),
  );
  fireEvent.click(dialog.getByRole("button", { name: "Добавить в приход" }));
  expect(
    screen.queryByRole("dialog", { name: "Новая номенклатура" }),
  ).not.toBeInTheDocument();
  expect(warehouseCatalogApi.create).not.toHaveBeenCalled();
  expect(receiptsApi.create).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Новая · Изменить" }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Создать приход" }));
  await waitFor(() => expect(receiptsApi.create).toHaveBeenCalledOnce());
  const body = vi.mocked(receiptsApi.create).mock.calls[0][0];
  expect(body.newItems).toEqual([
    {
      draftId: expect.any(String),
      item: { article: "NEW-1", name: "Новый товар", unit: "кг" },
    },
  ]);
  expect(body.lines).toEqual([
    { draftId: body.newItems![0].draftId, quantity: "1" },
  ]);
});
it("detects an existing article while editing and offers the existing item", async () => {
  vi.mocked(warehouseCatalogApi.list).mockImplementation(async (query) => ({
    items:
      query.get("q") === "A"
        ? [
            {
              id: "8",
              article: "A",
              name: "Existing",
              unit: "шт",
              comment: null,
              isActive: true,
            },
          ]
        : [],
    total: 1,
    limit: 100,
    offset: 0,
  }));
  render(
    <ReceiptManualForm
      actorId="actor"
      canCreateItems
      onCreated={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByRole("combobox", { name: "Номенклатура" }), {
    target: { value: "UNIQUE" },
  });
  fireEvent.click(
    await screen.findByRole("button", { name: "Создать номенклатуру" }),
  );
  const dialog = within(
    screen.getByRole("dialog", { name: "Новая номенклатура" }),
  );
  fireEvent.change(dialog.getByLabelText("Артикул"), {
    target: { value: "A" },
  });
  const useExisting = await dialog.findByRole("button", {
    name: "Выбрать существующую",
  });
  expect(
    dialog.getByRole("button", { name: "Добавить в приход" }),
  ).toBeDisabled();
  fireEvent.click(useExisting);
  fireEvent.click(screen.getByRole("button", { name: "Создать приход" }));
  await waitFor(() => expect(receiptsApi.create).toHaveBeenCalledOnce());
  expect(vi.mocked(receiptsApi.create).mock.calls[0][0].lines).toEqual([
    { itemId: "8", quantity: "1" },
  ]);
  expect(warehouseCatalogApi.create).not.toHaveBeenCalled();
});
