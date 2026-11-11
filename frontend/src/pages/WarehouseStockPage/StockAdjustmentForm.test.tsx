import { render, distribution, position } from "./stock-page-test-context";
import { StockDistributionModal } from "./StockDistributionModal";
import { warehouseStockApi } from "../../shared/api/warehouse-stock-api";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
afterEach(() => sessionStorage.clear());
const attach = async () => {
  fireEvent.change(screen.getByLabelText(/Документ/), {
    target: {
      files: [new File(["pdf"], "act.pdf", { type: "application/pdf" })],
    },
  });
  await screen.findByText("act.pdf");
};
const open = async () => {
  render(
    <StockDistributionModal
      position={position}
      canTransfer
      canAdjust
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Исправить количество: Угол ангара",
    }),
  );
};
it("hides correction actions without administrator permission", async () => {
  render(
    <StockDistributionModal
      position={position}
      canTransfer
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
  await screen.findByText("Угол ангара");
  expect(
    screen.queryByRole("button", { name: /Исправить количество/ }),
  ).not.toBeInTheDocument();
});
it("corrects physical quantity accepts zero and requires a reason", async () => {
  vi.mocked(warehouseStockApi.adjust).mockResolvedValue({});
  await open();
  expect(screen.getByText("10,001", { exact: false })).toBeVisible();
  fireEvent.change(screen.getByLabelText(/Фактически/), {
    target: { value: "0" },
  });
  const save = screen.getByRole("button", { name: "Сохранить" });
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Причина"), {
    target: { value: "Повреждено" },
  });
  expect(save).toBeDisabled();
  await attach();
  fireEvent.click(save);
  await waitFor(() => expect(warehouseStockApi.adjust).toHaveBeenCalledOnce());
  expect(vi.mocked(warehouseStockApi.adjust).mock.calls[0][0]).toMatchObject({
    expectedQuantity: distribution.locations[0].quantity,
    actualQuantity: "0",
    reason: "Повреждено",
    attachments: ["11111111-1111-4111-8111-111111111111"],
  });
});
it("preserves the original correction across a lost response and remount", async () => {
  vi.mocked(warehouseStockApi.adjust)
    .mockRejectedValueOnce(new Error("Ответ потерян"))
    .mockResolvedValueOnce({});
  await open();
  fireEvent.change(screen.getByLabelText(/Фактически/), {
    target: { value: "9" },
  });
  fireEvent.change(screen.getByLabelText("Причина"), {
    target: { value: "Потеря" },
  });
  await attach();
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await screen.findByRole("button", { name: "Повторить сохранение" });
  const first = vi.mocked(warehouseStockApi.adjust).mock.calls[0][0];
  expect(
    JSON.parse(sessionStorage.getItem("stock-adjustment:10:free")!),
  ).toEqual(first);
  cleanup();
  await open();
  expect(screen.getByLabelText(/Фактически/)).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Повторить сохранение" }));
  await waitFor(() =>
    expect(warehouseStockApi.adjust).toHaveBeenCalledTimes(2),
  );
  expect(vi.mocked(warehouseStockApi.adjust).mock.calls[1][0]).toEqual(first);
  await waitFor(() =>
    expect(sessionStorage.getItem("stock-adjustment:10:free")).toBeNull(),
  );
});

it("keeps the same dialog and backdrop when switching to correction and back", async () => {
  render(
    <StockDistributionModal
      position={position}
      canTransfer
      canAdjust
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
  const edit = await screen.findByRole("button", {
    name: "Исправить количество: Угол ангара",
  });
  const dialog = screen.getByRole("dialog");
  const backdrop = dialog.parentElement;
  fireEvent.click(edit);
  expect(screen.getByRole("dialog", { name: "Исправить количество" })).toBe(
    dialog,
  );
  expect(dialog.parentElement).toBe(backdrop);
  fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
  expect(screen.getByRole("dialog", { name: /Места хранения/ })).toBe(dialog);
  expect(dialog.parentElement).toBe(backdrop);
});

it("does not allow saving when document upload fails", async () => {
  vi.mocked(warehouseStockApi.uploadAdjustmentDocument).mockRejectedValueOnce(
    new Error("Не удалось загрузить файл"),
  );
  await open();
  fireEvent.change(screen.getByLabelText(/Фактически/), {
    target: { value: "9" },
  });
  fireEvent.change(screen.getByLabelText("Причина"), {
    target: { value: "Потеря" },
  });
  fireEvent.change(screen.getByLabelText(/Документ/), {
    target: { files: [new File(["bad"], "act.pdf")] },
  });
  await screen.findByText("Не удалось загрузить файл");
  expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();
  expect(warehouseStockApi.adjust).not.toHaveBeenCalled();
});

it("corrects the selected reserved row rather than the complete physical balance", async () => {
  const reservationId = "22222222-2222-4222-8222-222222222222";
  const source = {
    ...distribution.locations[0],
    quantity: "5",
    freeQuantity: "4",
    reservedQuantity: "1",
    reservations: [
      {
        reservationId,
        quantity: "1",
        order: { id: "order", number: "202", name: "Монтаж" },
      },
    ],
  };
  vi.mocked(warehouseStockApi.distribution).mockResolvedValue({
    ...distribution,
    locations: [source],
  });
  vi.mocked(warehouseStockApi.adjust).mockResolvedValue({});
  render(
    <StockDistributionModal
      position={position}
      canTransfer
      canAdjust
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
  const edit = await screen.findAllByRole("button", {
    name: "Исправить количество: Угол ангара",
  });
  expect(edit).toHaveLength(2);
  fireEvent.click(edit[1]);
  expect(screen.getByLabelText(/Фактически/)).toHaveValue("1");
  fireEvent.change(screen.getByLabelText(/Фактически/), {
    target: { value: "0" },
  });
  fireEvent.change(screen.getByLabelText("Причина"), {
    target: { value: "Недостача резерва" },
  });
  await attach();
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await waitFor(() => expect(warehouseStockApi.adjust).toHaveBeenCalledOnce());
  expect(vi.mocked(warehouseStockApi.adjust).mock.calls[0][0]).toMatchObject({
    expectedQuantity: "5",
    actualQuantity: "4",
    portion: { reservationId, expectedQuantity: "1", actualQuantity: "0" },
  });
});
