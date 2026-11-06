import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { IntegrationEventsSection } from "./IntegrationEventsSection";
import {
  receiptIntegrationApi,
  type ReceiptEvent,
} from "../../shared/api/receipt-integration-api";
vi.mock("../../shared/api/receipt-integration-api", () => ({
  receiptIntegrationApi: { retry: vi.fn().mockResolvedValue({}) },
}));
afterEach(cleanup);
it("shows skipped warehouse documents as a result rather than an error and allows manual retry", () => {
  const event: ReceiptEvent = {
    id: "15",
    sourceCode: "one-c",
    sourceName: "Основная 1С",
    flowCode: "warehouse.receipts",
    status: "SKIPPED",
    objectId: "doc",
    version: "1",
    attempts: 1,
    lastErrorCode: null,
    resultCode: "ONE_C_WAREHOUSE_UNMAPPED",
    resultSummary: { documentNumber: "ПР-125", warehouseName: "Новый склад" },
    nextAttemptAt: "2026-11-02T00:00:00Z",
    receivedAt: "2026-11-02T00:00:00Z",
    processedAt: "2026-11-02T00:00:00Z",
  };
  const mutate = vi.fn((run: () => Promise<unknown>) => run().then(() => {}));
  render(
    <ChakraProvider value={defaultSystem}>
      <IntegrationEventsSection
        events={{ items: [event], total: 1 }}
        status=""
        setStatus={vi.fn()}
        page={1}
        setPage={vi.fn()}
        busy={false}
        loading={false}
        mutate={mutate}
        reload={vi.fn()}
      />
    </ChakraProvider>,
  );
  expect(screen.getByText("Пропущено")).toBeInTheDocument();
  expect(screen.getByText("Склад не подключён")).toBeInTheDocument();
  expect(screen.getByText(/ПР-125/)).toHaveTextContent("Новый склад");
  fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
  expect(receiptIntegrationApi.retry).toHaveBeenCalledWith("15");
});
