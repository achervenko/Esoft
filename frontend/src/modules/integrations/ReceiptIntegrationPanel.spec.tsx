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
    runs: vi.fn(),
    keys: vi.fn(),
    flows: vi.fn(),
    configure: vi.fn(),
    invoiceSchedule: vi.fn(),
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
  vi.mocked(receiptIntegrationApi.runs).mockResolvedValue({
    items: [],
    total: 0,
    limit: 25,
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
  expect(screen.getByRole("button", { name: "Добавить" })).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Создать ключ|Показать ключ/ }),
  ).not.toBeInTheDocument();
});

it.each(["header", "basic"])(
  "creates an exchange with %s authentication",
  async (mode) => {
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
    fireEvent.click(screen.getByRole("button", { name: "Добавить" }));
    expect(
      screen.queryByRole("switch", { name: "Автоматический импорт накладных" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Технический пользователь импорта"),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Название обмена/), {
      target: { value: "Обмен склада" },
    });
    fireEvent.change(screen.getByLabelText(/Базовый адрес 1С/), {
      target: { value: "http://example.test/" },
    });
    if (mode === "basic") {
      fireEvent.click(
        screen.getByRole("button", { name: "Способ входа в 1С" }),
      );
      fireEvent.click(
        await screen.findByRole("option", { name: "Логин и пароль (Basic)" }),
      );
      fireEvent.change(screen.getByLabelText(/Логин 1С/), {
        target: { value: "юзер" },
      });
      expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();
      fireEvent.change(screen.getByLabelText(/Пароль 1С/), {
        target: { value: " пароль " },
      });
    } else {
      fireEvent.change(screen.getByLabelText(/Authorization для/), {
        target: { value: "Bearer test" },
      });
    }
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
        authorization:
          mode === "basic"
            ? "Basic 0Y7Qt9C10YA6INC/0LDRgNC+0LvRjCA="
            : "Bearer test",
        isActive: true,
      }),
    );
  },
);

it("enables invoice scheduling on an existing exchange and requires its start", async () => {
  const source = {
    id: "id",
    code: "code",
    name: "Обмен склада",
    systemType: "ONE_C",
    baseUrl: "https://example.test/ERP/hs/docs/",
    actorUserId: "internal",
    isActive: true,
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
  };
  vi.mocked(receiptIntegrationApi.sources).mockResolvedValue([source]);
  vi.mocked(receiptIntegrationApi.configure).mockResolvedValue(source);
  vi.mocked(receiptIntegrationApi.invoiceSchedule).mockResolvedValue({
    enabled: false,
    lastSuccessAt: "2026-11-18T22:30:00Z",
    latest: null,
  });
  render(<ReceiptIntegrationPanel permissions={["integrations.manage"]} />);
  fireEvent.click(await screen.findByRole("button", { name: "Настроить" }));
  await screen.findByText("Расписание выключено");
  expect(
    await screen.findByText(/Последний успешный импорт/),
  ).toHaveTextContent(/19\.11\.(?:2026|26).*01:30/);
  fireEvent.click(
    screen.getByRole("switch", { name: "Автоматический импорт накладных" }),
  );
  expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/Начало первой синхронизации/), {
    target: { value: "2026-11-18T08:00:00+03:00" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await waitFor(() =>
    expect(receiptIntegrationApi.configure).toHaveBeenCalledWith(
      expect.objectContaining({
        flows: [
          expect.objectContaining({
            config: {
              enabled: true,
              initialFrom: "2026-11-18T08:00:00+03:00",
              intervalSeconds: 30,
              periodMinutes: 60,
              overlapMinutes: 15,
              timezone: "Europe/Moscow",
            },
          }),
        ],
      }),
    ),
  );
});

it("opens the exchange journal for the current Moscow day", async () => {
  vi.setSystemTime(new Date("2026-11-20T22:00:00Z"));
  try {
    render(<ReceiptIntegrationPanel permissions={["integrations.manage"]} />);
    await screen.findByText("За выбранный период обменов не было.");
    expect(
      vi.mocked(receiptIntegrationApi.runs).mock.calls[0][0].toString(),
    ).toBe("from=2026-11-21&to=2026-11-21&page=1");
    fireEvent.change(screen.getByLabelText("Дата с"), {
      target: { value: "2026-11-20" },
    });
    await waitFor(() =>
      expect(
        vi.mocked(receiptIntegrationApi.runs).mock.lastCall?.[0].get("from"),
      ).toBe("2026-11-20"),
    );
  } finally {
    vi.useRealTimers();
  }
});
