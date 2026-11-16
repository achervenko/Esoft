import {
  render,
  position,
  warehouse,
  location,
} from "./stock-page-test-context";
import { warehouseStockApi } from "../../shared/api/warehouse-stock-api";
import { warehouseCatalogApi } from "../../shared/api/warehouse-catalog-api";
import { WarehouseStockPage } from "./WarehouseStockPage";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
const reader = ["warehouse.stock.read"];
it("restores a surplus request only for the administrator who submitted it", () => {
  const ownKey = "stock-adjustment:admin-a:surplus";
  sessionStorage.setItem(
    ownKey,
    JSON.stringify({
      type: "SURPLUS",
      requestKey: "request-a",
      itemId: position.item.id,
      locationId: location.id,
      quantity: "3",
      reason: "Излишек",
      attachments: ["document-a"],
    }),
  );
  const page = (actorId: string) => (
    <WarehouseStockPage
      actorId={actorId}
      userPermissions={[...reader, "warehouse.adjustments.manage"]}
    />
  );
  const view = render(page("admin-a"));
  fireEvent.click(screen.getByRole("button", { name: "Добавить остаток" }));
  expect(
    screen.getByRole("button", { name: "Повторить сохранение" }),
  ).toBeEnabled();
  view.rerender(page("admin-b"));
  expect(
    screen.queryByRole("button", { name: "Повторить сохранение" }),
  ).toBeNull();
  expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();
  expect(warehouseStockApi.adjust).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(ownKey)).not.toBeNull();
});
it("adds stock through SURPLUS and retries an unconfirmed request with the same payload", async () => {
  const catalog = vi.spyOn(warehouseCatalogApi, "list").mockResolvedValue({
    items: [{ ...position.item, comment: null }],
    total: 1,
    limit: 50,
    offset: 0,
  });
  try {
    vi.mocked(warehouseStockApi.adjust)
      .mockRejectedValueOnce(new Error("Ответ потерян"))
      .mockResolvedValueOnce({ changed: true });
    render(
      <WarehouseStockPage
        userPermissions={[...reader, "warehouse.adjustments.manage"]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Добавить остаток" }));
    const modal = within(
      screen.getByRole("dialog", { name: "Добавить остаток" }),
    );
    fireEvent.focus(modal.getByRole("combobox", { name: "Номенклатура" }));
    fireEvent.click(
      await screen.findByRole("option", { name: "6204 — Подшипник" }),
    );
    fireEvent.click(modal.getByRole("combobox", { name: "Склад" }));
    fireEvent.click(
      await screen.findByRole("option", { name: warehouse.name }),
    );
    await waitFor(() =>
      expect(
        modal.getByRole("combobox", { name: "Место хранения" }),
      ).toBeEnabled(),
    );
    fireEvent.click(modal.getByRole("combobox", { name: "Место хранения" }));
    fireEvent.click(await screen.findByRole("option", { name: "Ящик" }));
    fireEvent.change(modal.getByLabelText(/Количество/), {
      target: { value: "2,125" },
    });
    fireEvent.change(modal.getByLabelText("Причина"), {
      target: { value: "Излишек" },
    });
    expect(modal.getByRole("button", { name: "Сохранить" })).toBeDisabled();
    fireEvent.drop(
      modal.getByRole("group", { name: "Область загрузки файлов" }),
      {
        dataTransfer: {
          files: [new File(["pdf"], "act.pdf", { type: "application/pdf" })],
        },
      },
    );
    await modal.findByText("act.pdf");
    fireEvent.click(modal.getByRole("button", { name: "Сохранить" }));
    await modal.findByText("Ответ потерян");
    const submitted = vi.mocked(warehouseStockApi.adjust).mock.calls[0][0];
    expect(submitted).toEqual({
      requestKey: expect.any(String),
      itemId: position.item.id,
      locationId: "9007199254740996",
      type: "SURPLUS",
      quantity: "2.125",
      reason: "Излишек",
      attachments: ["11111111-1111-4111-8111-111111111111"],
    });
    fireEvent.click(
      modal.getByRole("button", { name: "Повторить сохранение" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Добавить остаток" }),
      ).toBeNull(),
    );
    expect(warehouseStockApi.adjust).toHaveBeenLastCalledWith(submitted);
  } finally {
    catalog.mockRestore();
  }
});
