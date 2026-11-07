import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { IntegrationFlowStatus } from "./IntegrationFlowStatus";
import type { IntegrationFlow } from "../../shared/api/receipt-integration-api";

afterEach(cleanup);
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
  [base, true, "Ожидает первого обмена"],
  [{ ...base, lastSuccessAt: "2026-11-07T03:00:00Z" }, true, "Работает"],
  [{ ...base, isActive: false }, true, "Выключен"],
  [base, false, "Выключен"],
  [
    {
      ...base,
      lastSuccessAt: "2026-11-07T03:00:00Z",
      lastErrorAt: "2026-11-06T03:00:00Z",
      lastErrorCode: "ORDERS_SYNC_FAILED",
    },
    true,
    "Работает",
  ],
  [
    {
      ...base,
      lastSuccessAt: "2026-11-06T03:00:00Z",
      lastErrorAt: "2026-11-07T03:00:00Z",
      lastErrorCode: "INTEGRATION_HTTP_TIMEOUT",
    },
    true,
    "Есть проблема",
  ],
] as const)(
  "shows the current exchange state %#",
  (flow, sourceActive, label) => {
    render(
      <ChakraProvider value={defaultSystem}>
        <IntegrationFlowStatus
          flow={flow}
          sourceActive={sourceActive}
          name="Заказы 1С"
        />
      </ChakraProvider>,
    );
    expect(screen.getByText(label)).toBeVisible();
    if (label === "Есть проблема")
      expect(screen.getByText(/1С не ответила вовремя/)).toBeVisible();
    else expect(screen.queryByText(/Код:/)).not.toBeInTheDocument();
  },
);
