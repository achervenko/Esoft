import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { ReceiptConflictResolveForm } from "./ReceiptConflictResolveForm";
import { receiptsApi } from "../../shared/api/warehouse-receipts-api";
import { render } from "./receipts-test-render";
import { ApiRequestError } from "../../shared/api/api-error";
import { receipt } from "./receipts-test-context";
vi.mock("../../shared/api/warehouse-receipts-api", () => ({
  receiptsApi: { resolve: vi.fn() },
}));
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
});
it("sends the displayed source version and explicit reason when resolving a conflict", async () => {
  vi.mocked(receiptsApi.resolve).mockResolvedValue({});
  render(
    <ReceiptConflictResolveForm
      onSavingChange={vi.fn()}
      receipt={{ ...receipt, conflict: "SOURCE_LINES_CHANGED_AFTER_PLACEMENT" }}
      onClose={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Решение" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByText("Будет сохранён текущий документ."),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Обоснование"), {
    target: { value: "Факт подтверждён" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await waitFor(() =>
    expect(receiptsApi.resolve).toHaveBeenCalledWith(receipt.id, {
      action: "KEEP_CURRENT",
      reason: "Факт подтверждён",
      sourceVersion: "2",
    }),
  );
});

it("offers cancellation only when the conflict supports it", async () => {
  vi.mocked(receiptsApi.resolve).mockResolvedValue({});
  render(
    <ReceiptConflictResolveForm
      onSavingChange={vi.fn()}
      receipt={{ ...receipt, conflict: "SOURCE_CANCELLED_AFTER_PLACEMENT" }}
      onClose={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  expect(
    screen.queryByText("Будет сохранён текущий документ."),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Решение" }));
  fireEvent.click(
    await screen.findByRole("option", { name: "Принять отмену 1С" }),
  );
  fireEvent.change(screen.getByLabelText("Обоснование"), {
    target: { value: "Отмена подтверждена" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await waitFor(() =>
    expect(receiptsApi.resolve).toHaveBeenCalledWith(receipt.id, {
      action: "ACCEPT_CANCELLATION",
      reason: "Отмена подтверждена",
      sourceVersion: "2",
    }),
  );
});

it("shows item-level shortages and allows retry after updating stock", async () => {
  vi.mocked(receiptsApi.resolve)
    .mockRejectedValueOnce(
      new ApiRequestError(
        "На складе недостаточно товара для принятия отмены.",
        409,
        "WAREHOUSE_RECEIPT_CANCELLATION_STOCK_INSUFFICIENT",
        {
          shortages: [
            {
              itemId: "1",
              name: "Подшипник",
              unit: "шт",
              required: "5",
              physical: "4",
              shortage: "1",
            },
          ],
        },
      ),
    )
    .mockResolvedValueOnce({});
  const onSaved = vi.fn();
  render(
    <ReceiptConflictResolveForm
      receipt={{ ...receipt, conflict: "SOURCE_CANCELLED_AFTER_PLACEMENT" }}
      onClose={vi.fn()}
      onSaved={onSaved}
      onSavingChange={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Решение" }));
  fireEvent.click(
    await screen.findByRole("option", { name: "Принять отмену 1С" }),
  );
  fireEvent.change(screen.getByLabelText("Обоснование"), {
    target: { value: "Подтверждаю" },
  });
  const save = screen.getByRole("button", { name: "Сохранить" });
  expect(save).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(save);
  expect(
    await screen.findByText(
      /Подшипник · требуется 5 шт, в наличии 4 шт, не хватает 1 шт/,
    ),
  ).toBeVisible();
  fireEvent.click(save);
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
});
