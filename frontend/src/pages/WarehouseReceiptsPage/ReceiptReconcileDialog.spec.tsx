import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { render } from "./receipts-test-render";
import { ReceiptReconcileDialog } from "./ReceiptReconcileDialog";
import { receiptsApi } from "../../shared/api/warehouse-receipts-api";
import { receipt } from "./receipts-test-context";

vi.mock("../../shared/api/warehouse-receipts-api", () => ({
  receiptsApi: { get: vi.fn(), list: vi.fn(), reconcile: vi.fn() },
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("loads a suggestion outside the list page, prepares unambiguous pairs, and requires explicit confirmation", async () => {
  const manual = {
    ...receipt,
    id: "8",
    source: "MANUAL" as const,
    status: "PLACED" as const,
    documentNumber: "Р-123",
    lines: [
      {
        ...receipt.lines[0],
        id: "99",
        quantity: "4",
        placed: "4",
        remaining: "0",
      },
    ],
  };
  vi.mocked(receiptsApi.get).mockResolvedValue(manual);
  vi.mocked(receiptsApi.list).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    limit: 25,
  });
  vi.mocked(receiptsApi.reconcile).mockResolvedValue({});
  const onSaved = vi.fn();
  render(
    <ReceiptReconcileDialog
      receipt={receipt}
      initialManualId="8"
      onClose={vi.fn()}
      onSaved={onSaved}
    />,
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeEnabled(),
  );
  expect(
    screen.getByRole("button", { name: "Ручной приход" }),
  ).toHaveTextContent("Р-123");
  expect(receiptsApi.reconcile).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(receiptsApi.reconcile).toHaveBeenCalledWith(receipt.id, {
    manualReceiptId: "8",
    lines: [{ manualLineId: "99", receiptLineId: "2" }],
  });
});
it("does not choose between ambiguous target lines automatically", async () => {
  vi.mocked(receiptsApi.get).mockResolvedValue({
    ...receipt,
    id: "8",
    source: "MANUAL",
    status: "PLACED",
    lines: [{ ...receipt.lines[0], id: "99", placed: "4", remaining: "0" }],
  });
  vi.mocked(receiptsApi.list).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    limit: 25,
  });
  render(
    <ReceiptReconcileDialog
      receipt={{
        ...receipt,
        lines: [...receipt.lines, { ...receipt.lines[0], id: "3" }],
      }}
      initialManualId="8"
      onClose={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  await screen.findByText("Подшипник · 4 шт");
  expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();
  expect(receiptsApi.reconcile).not.toHaveBeenCalled();
});
