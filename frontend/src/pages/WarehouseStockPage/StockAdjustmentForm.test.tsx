import { render, distribution, position } from "./stock-page-test-context";
import { StockDistributionModal } from "./StockDistributionModal";
import { warehouseStockApi } from "../../shared/api/warehouse-stock-api";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
afterEach(() => sessionStorage.clear());
it("explains a physical shortage and blocks moving from the affected place", async () => {
  const affected = {
    ...distribution.locations[0],
    reservationMismatch: true,
  };
  vi.mocked(warehouseStockApi.distribution).mockResolvedValue({
    ...distribution,
    reservationMismatch: true,
    locations: [affected, distribution.locations[1]],
  });
  render(
    <StockDistributionModal
      actorId="test-actor"
      position={position}
      canTransfer
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
  expect(
    await screen.findByText(/Фактический остаток меньше резерва/),
  ).toBeVisible();
  expect(
    screen.getAllByRole("button", { name: "Переместить" })[0],
  ).toBeDisabled();
  expect(
    screen.getAllByRole("button", { name: "Переместить" })[1],
  ).toBeEnabled();
  expect(
    screen.getByRole("button", { name: "Переместить всё" }),
  ).toBeDisabled();
});
const attach = async () => {
  fireEvent.drop(
    screen.getByRole("group", { name: "Область загрузки файлов" }),
    {
      dataTransfer: {
        files: [new File(["pdf"], "act.pdf", { type: "application/pdf" })],
      },
    },
  );
  await screen.findByText("act.pdf");
};
const open = async () => {
  render(
    <StockDistributionModal
      actorId="test-actor"
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
      actorId="test-actor"
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
    JSON.parse(sessionStorage.getItem("stock-adjustment:test-actor:10:free")!),
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
    expect(
      sessionStorage.getItem("stock-adjustment:test-actor:10:free"),
    ).toBeNull(),
  );
});

it("keeps the same dialog and backdrop when switching to correction and back", async () => {
  render(
    <StockDistributionModal
      actorId="test-actor"
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
  fireEvent.drop(
    screen.getByRole("group", { name: "Область загрузки файлов" }),
    {
      dataTransfer: { files: [new File(["bad"], "act.pdf")] },
    },
  );
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
      actorId="test-actor"
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

it("counts the whole location and submits one adjustment with the chosen reserve split", async () => {
  vi.mocked(warehouseStockApi.adjust).mockResolvedValue({});
  const first = "11111111-1111-4111-8111-111111111112";
  const second = "11111111-1111-4111-8111-111111111113";
  vi.mocked(warehouseStockApi.distribution).mockResolvedValue({
    ...distribution,
    locations: [
      {
        ...distribution.locations[0],
        quantity: "10",
        freeQuantity: "3",
        reservedQuantity: "7",
        reservations: [
          {
            reservationId: first,
            order: { id: first, number: "101", name: "" },
            quantity: "4",
          },
          {
            reservationId: second,
            order: { id: second, number: "102", name: "" },
            quantity: "3",
          },
        ],
      },
    ],
  });
  render(
    <StockDistributionModal
      actorId="test-actor"
      position={position}
      canTransfer
      canAdjust
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Пересчитать место: Угол ангара",
    }),
  );
  fireEvent.change(screen.getByLabelText(/Фактически на месте/), {
    target: { value: "6" },
  });
  fireEvent.change(screen.getByLabelText("Причина"), {
    target: { value: "Пересчёт" },
  });
  await attach();
  const save = screen.getByRole("button", { name: "Сохранить" });
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Оставить в резерве заказа 101"), {
    target: { value: "3" },
  });
  expect(save).toBeEnabled();
  fireEvent.change(screen.getByLabelText("Оставить в резерве заказа 102"), {
    target: { value: "2" },
  });
  expect(
    screen.getByText("Свободный остаток после пересчёта: 1 шт"),
  ).toBeVisible();
  fireEvent.click(save);
  await waitFor(() => expect(warehouseStockApi.adjust).toHaveBeenCalledOnce());
  expect(warehouseStockApi.adjust).toHaveBeenCalledWith(
    expect.objectContaining({
      expectedQuantity: "10",
      actualQuantity: "6",
      shortageAllocations: [
        { reservationId: first, expectedQuantity: "4", quantity: "1" },
        { reservationId: second, expectedQuantity: "3", quantity: "1" },
      ],
    }),
  );
});
