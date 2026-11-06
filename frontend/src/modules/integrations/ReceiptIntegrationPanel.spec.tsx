import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render as baseRender,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { ReactElement } from "react";
import { ReceiptIntegrationPanel } from "./ReceiptIntegrationPanel";
import { receiptIntegrationApi } from "../../shared/api/receipt-integration-api";
vi.mock("../../shared/api/receipt-integration-api", () => ({
  receiptIntegrationApi: {
    sources: vi.fn(),
    events: vi.fn(),
    keys: vi.fn(),
    flows: vi.fn(),
    configure: vi.fn(),
  },
}));
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(receiptIntegrationApi.sources).mockResolvedValue([]);
  vi.mocked(receiptIntegrationApi.flows).mockResolvedValue([
    {
      flowCode: "warehouse.receipts",
      name: "Приходы склада",
      systemTypes: ["ONE_C"],
      configVersions: [1],
      incomingActions: ["event:create"],
    },
  ]);
  vi.mocked(receiptIntegrationApi.events).mockResolvedValue({
    items: [],
    total: 0,
  });
});
function render(ui: ReactElement) {
  return baseRender(ui, {
    wrapper: ({ children }) => (
      <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
    ),
  });
}
it("does not load integration data without the admin integration permission", () => {
  render(<ReceiptIntegrationPanel permissions={["warehouse.receipts.read"]} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Недостаточно прав");
  expect(receiptIntegrationApi.sources).not.toHaveBeenCalled();
});
it("allows configuration but exposes no key generation or secret display", async () => {
  render(<ReceiptIntegrationPanel permissions={["integrations.manage"]} />);
  await screen.findByText("Источники обмена не добавлены.");
  expect(
    screen.getByRole("button", { name: "Добавить базу 1С" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Создать ключ|Показать ключ/ }),
  ).not.toBeInTheDocument();
});

it("creates an exchange using only its name and connection details", async () => {
  vi.mocked(receiptIntegrationApi.configure).mockResolvedValue({
    id: "id",
    code: "code",
    name: "Обмен склада",
    systemType: "ONE_C",
    flows: [],
    baseUrl: "http://example.test/",
    actorUserId: "internal",
    isActive: true,
  });
  render(<ReceiptIntegrationPanel permissions={["integrations.manage"]} />);
  await screen.findByText("Источники обмена не добавлены.");
  fireEvent.click(screen.getByRole("button", { name: "Добавить базу 1С" }));
  expect(
    screen.queryByText("Технический пользователь импорта"),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Название обмена/), {
    target: { value: "Обмен склада" },
  });
  fireEvent.change(screen.getByLabelText(/Базовый URL/), {
    target: { value: "http://example.test/" },
  });
  fireEvent.change(screen.getByLabelText(/Authorization для/), {
    target: { value: "Bearer test" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await waitFor(() =>
    expect(receiptIntegrationApi.configure).toHaveBeenCalledExactlyOnceWith({
      code: undefined,
      name: "Обмен склада",
      flows: [
        {
          flowCode: "warehouse.receipts",
          configVersion: 1,
          config: {},
          isActive: true,
          lastSuccessAt: null,
          lastErrorAt: null,
          lastErrorCode: null,
        },
      ],
      baseUrl: "http://example.test/",
      authorization: "Bearer test",
      isActive: true,
    }),
  );
});
