import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { render } from "./receipts-test-render";
import { ReceiptReconciliationCandidates } from "./ReceiptReconciliationCandidates";
import { receiptsApi } from "../../shared/api/warehouse-receipts-api";
import { receipt } from "./receipts-test-context";

vi.mock("../../shared/api/warehouse-receipts-api", () => ({
  receiptsApi: { reconciliationCandidates: vi.fn() },
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const candidate = {
  id: "8",
  status: "PLACED" as const,
  documentNumber: "Р-123",
  documentDate: "2026-10-30",
  sameNumber: true,
  sameItems: true,
  sameQuantities: false,
  matchedItems: 1,
  manualItems: 1,
  dateDistance: 0,
};

it("explains matches and differences and only opens the selected document for review", async () => {
  vi.mocked(receiptsApi.reconciliationCandidates).mockResolvedValue({
    items: [candidate],
  });
  const onSelect = vi.fn();
  render(
    <ReceiptReconciliationCandidates receipt={receipt} onSelect={onSelect} />,
  );
  await screen.findByText("Р-123");
  expect(screen.getByText(/Количества различаются/)).toBeInTheDocument();
  expect(onSelect).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Проверить и связать" }));
  expect(onSelect).toHaveBeenCalledWith("8");
});
it("does not offer reconciliation until a partial manual receipt is completed", async () => {
  vi.mocked(receiptsApi.reconciliationCandidates).mockResolvedValue({
    items: [{ ...candidate, status: "PLACING" }],
  });
  render(
    <ReceiptReconciliationCandidates receipt={receipt} onSelect={vi.fn()} />,
  );
  expect(
    await screen.findByRole("button", { name: "Открыть ручной приход" }),
  ).toBeEnabled();
  expect(
    screen.queryByRole("button", { name: "Проверить и связать" }),
  ).not.toBeInTheDocument();
});
it("makes a failed duplicate check visible instead of claiming no matches", async () => {
  vi.mocked(receiptsApi.reconciliationCandidates).mockRejectedValue(
    Error("Offline"),
  );
  render(
    <ReceiptReconciliationCandidates receipt={receipt} onSelect={vi.fn()} />,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Не удалось проверить ручные приходы",
  );
});

it("shows an undated number match without claiming a matching date", async () => {
  vi.mocked(receiptsApi.reconciliationCandidates).mockResolvedValue({
    items: [{ ...candidate, documentDate: null, dateDistance: null }],
  });
  render(
    <ReceiptReconciliationCandidates receipt={receipt} onSelect={vi.fn()} />,
  );
  await screen.findByText("Р-123");
  expect(screen.getByText(/Совпадает номер накладной/)).toBeInTheDocument();
  expect(
    screen.queryByText(/Совпадает дата накладной/),
  ).not.toBeInTheDocument();
});
