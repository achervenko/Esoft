import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { IntegrationKeysSection } from "./IntegrationKeysSection";
import type { ReceiptSource } from "../../shared/api/receipt-integration-api";
afterEach(cleanup);
it("does not offer an incoming endpoint or key for a pull-only flow", () => {
  const source: ReceiptSource = {
    id: "id",
    code: "code",
    name: "1С",
    systemType: "ONE_C",
    baseUrl: "http://example.test/",
    actorUserId: "actor",
    isActive: true,
    flows: [
      {
        flowCode: "orders.customers",
        configVersion: 1,
        config: {},
        isActive: true,
        lastSuccessAt: null,
        lastErrorAt: null,
        lastErrorCode: null,
      },
    ],
  };
  render(
    <ChakraProvider value={defaultSystem}>
      <IntegrationKeysSection
        sources={[source]}
        availableFlows={[
          {
            flowCode: "orders.customers",
            name: "Заказы клиентов 1С",
            systemTypes: ["ONE_C"],
            configVersions: [1],
            incomingActions: [],
          },
        ]}
        keys={[]}
        selected="code"
        setSelected={vi.fn()}
        busy={false}
        mutate={vi.fn()}
        reload={vi.fn()}
      />
    </ChakraProvider>,
  );
  expect(screen.queryByLabelText(/Адрес событий/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Выпустить ключ" })).toBeDisabled();
});
