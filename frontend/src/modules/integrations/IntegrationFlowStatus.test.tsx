import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { IntegrationFlowStatus } from "./IntegrationFlowStatus";
import type { IntegrationFlow } from "../../shared/api/receipt-integration-api";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const base: IntegrationFlow = {
  flowCode: "orders.customers",
  configVersion: 1,
  config: {},
  isActive: true,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastErrorCode: null,
};
it.each([
  [base, "Ожидает первого обмена"],
  [{ ...base, lastSuccessAt: "2026-11-07T03:00:00Z" }, "Работает"],
  [{ ...base, isActive: false }, "Выключен"],
  [
    {
      ...base,
      lastSuccessAt: "2026-11-07T03:00:00Z",
      lastErrorAt: "2026-11-06T03:00:00Z",
      lastErrorCode: "ORDERS_SYNC_FAILED",
    },
    "Работает",
  ],
  [
    {
      ...base,
      lastSuccessAt: "2026-11-06T03:00:00Z",
      lastErrorAt: "2026-11-07T03:00:00Z",
      lastErrorCode: "INTEGRATION_HTTP_TIMEOUT",
    },
    "Есть проблема",
  ],
] as const)("shows the current exchange state %#", async (flow, label) => {
  render(
    <ChakraProvider value={defaultSystem}>
      <IntegrationFlowStatus flow={flow} name="Заказы 1С" />
    </ChakraProvider>,
  );
  expect(screen.getByText(label)).toBeVisible();
  expect(screen.queryByText(/Код:/)).not.toBeInTheDocument();
  if (label === "Есть проблема") {
    fireEvent.click(screen.getByRole("button", { name: /Подробности ошибки/ }));
    expect(await screen.findByText(/1С не ответила вовремя/)).toBeVisible();
  }
});

it.each([
  [null, "Ожидает первого обмена"],
  ["SUCCESS", "Работает"],
  ["FAILED", "Ошибка обмена"],
  ["PARTIAL_FAILURE", "Частично обработан"],
  ["BLOCKED", "Требуется проверить настройки"],
  ["RUNNING", "Выполняется"],
  ["INTERRUPTED", "Прерван"],
] as const)("shows scheduler outcome %s", async (outcome, label) => {
  const errorCode = outcome === "FAILED" ? "TEST_ERROR" : null;
  const flow = { ...base, flowCode: "warehouse.receipts" };
  const view = (scheduleSummary: IntegrationFlow["scheduleSummary"]) => (
    <ChakraProvider value={defaultSystem}>
      <IntegrationFlowStatus
        flow={{ ...flow, scheduleSummary }}
        name="Приходы склада"
      />
    </ChakraProvider>
  );
  const { rerender } = render(view({ outcome, errorCode }));
  expect(screen.getByText(label)).toBeVisible();
  if (errorCode) {
    fireEvent.click(screen.getByRole("button", { name: /Подробности ошибки/ }));
    expect(await screen.findByText(/Код: TEST_ERROR/)).toBeVisible();
  }
  rerender(view(null));
  expect(screen.getByText("Ожидает первого обмена")).toBeVisible();
});
