import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { ReceiptDetails } from "./ReceiptDetails";
import { receiptsApi } from "../../shared/api/warehouse-receipts-api";
import { receipt, permissions } from "./receipts-test-context";
import { render } from "./receipts-test-render";
import { formatBusinessDateTime } from "../../shared/lib/business-date";
vi.mock("../../shared/api/warehouse-receipts-api", () => ({
  receiptsApi: { get: vi.fn(), reconciliationCandidates: vi.fn() },
}));
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  vi.mocked(receiptsApi.reconciliationCandidates).mockResolvedValue({
    items: [],
  });
});
it("shows the last received version time rather than the record creation time", async () => {
  vi.mocked(receiptsApi.get).mockResolvedValue(receipt);
  render(
    <ReceiptDetails
      id={receipt.id}
      actorId="actor"
      permissions={permissions}
      onBack={vi.fn()}
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Действия" }));
  expect(
    await screen.findByText(
      `Получен: ${formatBusinessDateTime(receipt.receivedAt)}`,
    ),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(`Получен: ${formatBusinessDateTime(receipt.createdAt)}`),
  ).not.toBeInTheDocument();
});
it("does not offer warehouse mapping for an unmapped 1C receipt even with mapping permission", async () => {
  vi.mocked(receiptsApi.get).mockResolvedValue({
    ...receipt,
    warehouseId: null,
    warehouseNameSnapshot: null,
  });
  render(
    <ReceiptDetails
      id={receipt.id}
      actorId="actor"
      permissions={permissions}
      onBack={vi.fn()}
    />,
  );
  await screen.findByRole("heading", { name: receipt.documentNumber! });
  fireEvent.click(screen.getByRole("button", { name: "Действия" }));
  await screen.findByText("Склад: Не сопоставлен");
  expect(
    screen.queryByRole("button", { name: "Выбрать склад ESoft" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("dialog", { name: "Сопоставить склад" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Разместить" })).toBeDisabled();
});

it("keeps recovery available after the server has fully placed the line", async () => {
  sessionStorage.setItem(
    `warehouse.receipts.pending:actor:place:${receipt.id}:${receipt.lines[0].id}`,
    JSON.stringify({
      requestKey: "saved-key",
      body: { storageLocationId: "4", quantity: "6" },
    }),
  );
  vi.mocked(receiptsApi.get).mockResolvedValue({
    ...receipt,
    status: "PLACED",
    lines: [{ ...receipt.lines[0], placed: "6", remaining: "0" }],
  });
  render(
    <ReceiptDetails
      actorId="actor"
      onBack={vi.fn()}
      id={receipt.id}
      permissions={permissions}
    />,
  );
  expect(
    await screen.findByRole("button", { name: "Проверить размещение" }),
  ).toBeEnabled();
});

it("explains a repost after settlement and keeps placement blocked", async () => {
  vi.mocked(receiptsApi.get).mockResolvedValue({
    ...receipt,
    status: "CANCELLED",
    conflict: "SOURCE_REPOSTED_AFTER_SETTLEMENT",
    pendingSourceDocument: { status: "POSTED" },
  });
  render(
    <ReceiptDetails
      actorId="actor"
      id={receipt.id}
      permissions={permissions}
      onBack={vi.fn()}
    />,
  );
  expect(
    await screen.findByText(/Старые размещения не подтверждают новую приёмку/),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Разместить" })).toBeDisabled();
});

it("blocks placement during a conflict and hides admin resolution from a keeper", async () => {
  vi.mocked(receiptsApi.get).mockResolvedValue({
    ...receipt,
    conflict: "SOURCE_CANCELLED_AFTER_PLACEMENT",
    pendingSourceDocument: { version: "3", status: "CANCELLED" },
  });
  render(
    <ReceiptDetails
      actorId="actor"
      onBack={vi.fn()}
      id={receipt.id}
      permissions={permissions.filter((p) => p !== "integrations.manage")}
    />,
  );
  expect(await screen.findByText("Требуется решение")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Разместить" })).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: "Разобрать конфликт" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Действия" }));
  expect(screen.getByRole("dialog", { name: "Действия" })).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Связать с ручным приходом" }),
  ).not.toBeInTheDocument();
});
