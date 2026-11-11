import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { render } from "./receipts-test-render";
import { ReceiptManualForm } from "./ReceiptManualForm";
import { receiptsApi } from "../../shared/api/warehouse-receipts-api";
import { receipt } from "./receipts-test-context";

vi.mock("../../shared/api/warehouse-receipts-api", () => ({
  receiptsApi: { create: vi.fn() },
}));
vi.mock("./useReceiptStorage", () => ({
  useReceiptStorage: () => ({
    warehouses: [{ id: "4", name: "Единственный склад" }],
    error: null,
  }),
}));
vi.mock("../../shared/warehouse/ReceiptItemPicker", () => ({
  ReceiptItemPicker: ({ onChange }: { onChange: (item: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onChange({ id: "8", name: "Товар", article: "A", unit: "шт" })
      }
    >
      Выбрать товар
    </button>
  ),
}));
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.resetAllMocks();
});
it("opens as a modal, selects the only warehouse and manages numbered lines", async () => {
  vi.mocked(receiptsApi.create).mockResolvedValue(receipt);
  render(
    <ReceiptManualForm
      actorId="actor"
      onCreated={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  expect(
    screen.getByRole("dialog", { name: "Ручной приход" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/Документ фиксирует ожидаемый товар/),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/Строки прихода:/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Удалить строку 1" }));
  expect(
    screen.getByText("В приходе должна остаться хотя бы одна строка."),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Добавить строку" }));
  expect(
    screen.getAllByRole("button", { name: /Удалить строку/ }),
  ).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Удалить строку 2" }));
  fireEvent.click(screen.getByRole("button", { name: "Выбрать товар" }));
  fireEvent.click(screen.getByRole("button", { name: "Создать приход" }));
  await waitFor(() =>
    expect(receiptsApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        warehouseId: "4",
        lines: [{ itemId: "8", quantity: "1" }],
      }),
    ),
  );
});
it("allows replacing a quantity without showing an error until blur", () => {
  render(
    <ReceiptManualForm
      actorId="actor"
      onCreated={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  const quantity = screen.getByLabelText("Количество");
  fireEvent.focus(quantity);
  fireEvent.change(quantity, { target: { value: "" } });
  expect(screen.queryByText(/Введите число, до трёх/)).not.toBeInTheDocument();
  fireEvent.blur(quantity);
  expect(screen.getByText(/Введите число, до трёх/)).toBeInTheDocument();
  fireEvent.change(quantity, { target: { value: "3,125" } });
  expect(screen.getByText(/Введите число, до трёх/)).toHaveAttribute(
    "data-visible",
    "false",
  );
});

it("retries the stored manual operation after a page reload without requiring new input", async () => {
  const attempt = {
    requestKey: "d1d49b5e-0d0b-4502-9bab-9b79f65cd5aa",
    body: {
      warehouseId: "4",
      documentNumber: "Н-1",
      lines: [{ itemId: "8", quantity: "12.5" }],
    },
  };
  sessionStorage.setItem(
    "warehouse.receipts.pending:actor:manual",
    JSON.stringify(attempt),
  );
  vi.mocked(receiptsApi.create).mockResolvedValue(receipt);
  const onCreated = vi.fn();
  render(
    <ReceiptManualForm
      actorId="actor"
      onCreated={onCreated}
      onCancel={vi.fn()}
    />,
  );
  expect(screen.getByLabelText("Номер накладной")).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "Проверить предыдущую отправку" }),
  );
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith(receipt.id));
  expect(receiptsApi.create).toHaveBeenCalledWith({
    ...attempt.body,
    requestKey: attempt.requestKey,
  });
  expect(sessionStorage.length).toBe(0);
});
