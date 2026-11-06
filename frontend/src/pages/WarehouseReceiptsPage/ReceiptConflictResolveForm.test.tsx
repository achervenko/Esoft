import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { ReceiptConflictResolveForm } from "./ReceiptConflictResolveForm";
import { receiptsApi } from "../../shared/api/warehouse-receipts-api";
import { render } from "./receipts-test-render";
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
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await waitFor(() =>
    expect(receiptsApi.resolve).toHaveBeenCalledWith(receipt.id, {
      action: "ACCEPT_CANCELLATION",
      reason: "Отмена подтверждена",
      sourceVersion: "2",
    }),
  );
});

it("requires performed corrections when agreeing our error with 1C", async () => {
  vi.mocked(receiptsApi.resolve).mockResolvedValue({});
  render(
    <ReceiptConflictResolveForm
      canReconcileStock
      receipt={{ ...receipt, conflict: "SOURCE_CANCELLED_AFTER_PLACEMENT" }}
      onClose={vi.fn()}
      onSaved={vi.fn()}
      onSavingChange={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Решение" }));
  fireEvent.click(
    await screen.findByRole("option", {
      name: "Согласовать с 1С после корректировки",
    }),
  );
  fireEvent.change(screen.getByLabelText("Обоснование"), {
    target: { value: "Факт исправлен" },
  });
  expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Номера проведённых корректировок"), {
    target: { value: "12, 13" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await waitFor(() =>
    expect(receiptsApi.resolve).toHaveBeenCalledWith(receipt.id, {
      action: "RECONCILE_CANCELLATION",
      reason: "Факт исправлен",
      sourceVersion: "2",
      adjustmentIds: ["12", "13"],
    }),
  );
});
