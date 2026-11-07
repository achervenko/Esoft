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
import { OrdersPage } from "./OrdersPage";
import {
  ordersApi,
  type OrderData,
  type OrderSource,
} from "../../shared/api/orders-api";
vi.mock("../../shared/api/orders-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../shared/api/orders-api")>()),
  ordersApi: {
    list: vi.fn(),
    sources: vi.fn(),
    detail: vi.fn(),
    history: vi.fn(),
    refresh: vi.fn(),
  },
}));
const row: OrderData = {
  id: "8f23444c-b5ab-11f1-9606-40a8f031fdf3",
  externalId: "8f23444c-b5ab-11f1-9606-40a8f031fdf3",
  sourceId: "source",
  number: "721",
  name: "",
  documentDate: "2026-09-21T13:59:49",
  status: "ДругойСтатус",
  posted: true,
  deletionMark: false,
  changedAt: "2026-11-06T00:00:00Z",
  missingChecks: 0,
  checkedAt: "2026-11-06T00:00:00Z",
  source: { name: "База 1С" },
};
const source: OrderSource = {
  id: "source",
  name: "База 1С",
  isActive: true,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastErrorCode: null,
  runs: [],
};
const render = (ui: ReactElement) =>
  baseRender(ui, {
    wrapper: ({ children }) => (
      <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
    ),
  });
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(ordersApi.list).mockResolvedValue({
    statuses: ["ДругойСтатус", "Закрыт", "КОбеспечению"],
    items: [row],
    total: 1,
    page: 1,
    limit: 50,
  });
  vi.mocked(ordersApi.sources).mockResolvedValue([source]);
  vi.mocked(ordersApi.detail).mockResolvedValue(row);
  vi.mocked(ordersApi.history).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    limit: 20,
  });
});
it("does not request orders without permission", () => {
  render(<OrdersPage userPermissions={[]} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Недостаточно прав");
  expect(ordersApi.list).not.toHaveBeenCalled();
});
it("shows the mirror including unknown status and a missing name, without edit actions", async () => {
  render(<OrdersPage userPermissions={["orders.read"]} />);
  expect(
    await screen.findByRole("link", { name: /^721\s+ДругойСтатус$/ }),
  ).toHaveAttribute("href", `#/orders/${row.id}`);
  expect(screen.getByText("ДругойСтатус")).toBeVisible();
  expect(screen.queryByText(/Обновлено:/)).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Обновить" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Создать|Удалить|Редактировать/ }),
  ).not.toBeInTheDocument();
});
it("filters by statuses and deletion with a hidden single source", async () => {
  render(<OrdersPage userPermissions={["orders.read"]} />);
  await screen.findByText("ДругойСтатус");
  expect(vi.mocked(ordersApi.list).mock.calls.at(-1)?.[0].get("deleted")).toBe(
    "false",
  );
  fireEvent.click(screen.getByRole("button", { name: "Фильтры заказов" }));
  expect(
    screen.queryByRole("button", { name: "Источник" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Статус" }));
  fireEvent.click(await screen.findByRole("option", { name: "КОбеспечению" }));
  await waitFor(() =>
    expect(
      vi.mocked(ordersApi.list).mock.calls.at(-1)?.[0].get("statuses"),
    ).toBe(JSON.stringify(["КОбеспечению"])),
  );
  fireEvent.click(screen.getByRole("button", { name: "Удалённые в 1С" }));
  fireEvent.click(await screen.findByRole("option", { name: "Все" }));
  await waitFor(() =>
    expect(
      vi.mocked(ordersApi.list).mock.calls.at(-1)?.[0].get("deleted"),
    ).toBe("all"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Сбросить" }));
  await waitFor(() => {
    const params = vi.mocked(ordersApi.list).mock.calls.at(-1)?.[0];
    expect(params?.has("statuses")).toBe(false);
    expect(params?.get("deleted")).toBe("false");
  });
});
it("offers the source filter for multiple connections", async () => {
  vi.mocked(ordersApi.sources).mockResolvedValue([
    source,
    { ...source, id: "other", name: "Другая база" },
  ]);
  render(<OrdersPage userPermissions={["orders.read"]} />);
  await screen.findByText("ДругойСтатус");
  fireEvent.click(screen.getByRole("button", { name: "Фильтры заказов" }));
  expect(screen.getByRole("button", { name: "Источник" })).toBeVisible();
});
it("debounces search and sends the number/name query", async () => {
  render(<OrdersPage userPermissions={["orders.read"]} />);
  await screen.findByText("ДругойСтатус");
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "РИТЭК" },
  });
  await waitFor(() =>
    expect(vi.mocked(ordersApi.list).mock.calls.at(-1)?.[0].get("search")).toBe(
      "РИТЭК",
    ),
  );
});
it("retains status choices while loading and after a failed filter request", async () => {
  let rejectRequest!: (error: Error) => void;
  vi.mocked(ordersApi.list)
    .mockResolvedValueOnce({
      items: [row],
      statuses: ["Закрыт", "КОбеспечению"],
      total: 1,
      page: 1,
      limit: 50,
    })
    .mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectRequest = reject;
        }),
    );
  render(<OrdersPage userPermissions={["orders.read"]} />);
  await screen.findByText("ДругойСтатус");
  fireEvent.click(screen.getByRole("button", { name: "Фильтры заказов" }));
  fireEvent.click(screen.getByRole("button", { name: "Статус" }));
  fireEvent.click(await screen.findByRole("option", { name: "Закрыт" }));
  await waitFor(() => expect(ordersApi.list).toHaveBeenCalledTimes(2));
  expect(screen.getByRole("button", { name: "Статус" })).toHaveTextContent(
    "Закрыт",
  );
  expect(
    await screen.findByRole("option", { name: "КОбеспечению" }),
  ).toBeVisible();
  rejectRequest(new Error("Сбой загрузки заказов"));
  expect(await screen.findByText("Сбой загрузки заказов")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Статус" })).toHaveTextContent(
    "Закрыт",
  );
  expect(screen.getByRole("option", { name: "КОбеспечению" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Сбросить" }));
  await waitFor(() =>
    expect(
      vi.mocked(ordersApi.list).mock.calls.at(-1)?.[0].has("statuses"),
    ).toBe(false),
  );
});
it("appends pages, retries the same failed page and resets on search", async () => {
  const firstPage = {
    items: Array.from({ length: 50 }, (_, index) => ({
      ...row,
      id: String(index),
      number: String(index),
    })),
    statuses: [row.status],
    total: 51,
    page: 1,
    limit: 50,
  };
  vi.mocked(ordersApi.list)
    .mockResolvedValueOnce(firstPage)
    .mockRejectedValueOnce(new Error("Сбой загрузки"))
    .mockResolvedValueOnce({
      ...firstPage,
      items: [{ ...row, id: "last" }],
      page: 2,
    })
    .mockResolvedValueOnce({
      ...firstPage,
      items: [{ ...row, id: "found", number: "Найденный" }],
      total: 1,
    });
  render(<OrdersPage userPermissions={["orders.read"]} />);
  fireEvent.click(await screen.findByRole("button", { name: "Показать ещё" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Повторить загрузку" }),
  );
  expect(await screen.findByText("Показано 51 из 51")).toBeVisible();
  expect(
    vi
      .mocked(ordersApi.list)
      .mock.calls.slice(0, 3)
      .map(([params]) => params.get("page")),
  ).toEqual(["1", "2", "2"]);
  expect(ordersApi.sources).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "Найденный" },
  });
  expect(await screen.findByText("Найденный")).toBeVisible();
  expect(vi.mocked(ordersApi.list).mock.calls.at(-1)?.[0].get("page")).toBe(
    "1",
  );
  expect(screen.queryByText("Показано 51 из 51")).not.toBeInTheDocument();
});
it("keeps exchange controls and diagnostics out of orders for administrators", async () => {
  vi.mocked(ordersApi.sources).mockResolvedValue([
    { ...source, lastErrorCode: "INTEGRATION_HTTP_TIMEOUT" },
  ]);
  render(
    <OrdersPage userPermissions={["orders.read", "integrations.manage"]} />,
  );
  await screen.findByText("ДругойСтатус");
  expect(
    screen.queryByRole("button", { name: "Обновить" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText(
      /Обновлено:|Последние обновления|INTEGRATION_HTTP_TIMEOUT/,
    ),
  ).not.toBeInTheDocument();
  expect(ordersApi.refresh).not.toHaveBeenCalled();
});
it("opens read-only order details and history", async () => {
  render(<OrdersPage userPermissions={["orders.read"]} orderId={row.id} />);
  expect(
    await screen.findByRole("heading", { name: "Заказ №721" }),
  ).toBeVisible();
  expect(screen.getByText("Дата заказа")).toBeVisible();
  expect(screen.getByText("21.09.2026 13:59")).toBeVisible();
  expect(screen.getByRole("link", { name: "Назад" })).toHaveAttribute(
    "href",
    "#/orders",
  );
  expect(ordersApi.history).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("История изменений"));
  await waitFor(() =>
    expect(ordersApi.history).toHaveBeenCalledWith(
      row.id,
      1,
      expect.any(AbortSignal),
    ),
  );
  expect(ordersApi.detail).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/Время отражает/)).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Удалить|Сохранить|Резерв/ }),
  ).not.toBeInTheDocument();
});
it.each([false, true])(
  "shows deletion only as a badge when marked: %s",
  async (deletionMark) => {
    vi.mocked(ordersApi.detail).mockResolvedValue({ ...row, deletionMark });
    render(<OrdersPage userPermissions={["orders.read"]} orderId={row.id} />);
    await screen.findByRole("heading", { name: "Заказ №721" });
    expect(screen.queryByText("Пометка удаления")).not.toBeInTheDocument();
    if (deletionMark) {
      expect(screen.getByText("Удалён в 1С")).toBeVisible();
      expect(screen.getByText("Удалён в 1С")).not.toHaveAttribute("title");
    } else expect(screen.queryByText("Удалён в 1С")).not.toBeInTheDocument();
  },
);
