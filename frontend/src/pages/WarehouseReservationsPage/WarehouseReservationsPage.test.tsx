import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render as baseRender,
  screen,
  waitFor,
} from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { WarehouseReservationsPage } from "./WarehouseReservationsPage";
import {
  warehouseReservationsApi,
  type ReservationOrdersPage,
} from "../../shared/api/warehouse-reservations-api";
import { resolveAppRoute } from "../../layouts/app-router";
import { canAccessWorkspaceRoute } from "../../lib/role-navigation";

vi.mock("../../shared/api/warehouse-reservations-api", () => ({
  warehouseReservationsApi: { orders: vi.fn() },
}));
const row = {
  order: {
    id: "a",
    number: "202",
    name: "Монтаж",
    status: "Закрыт",
    closed: true,
    warnings: [],
  },
  positionsCount: 3,
  deficitPositionsCount: 1,
};
const page: ReservationOrdersPage = {
  items: [row],
  total: 1,
  limit: 50,
  page: 1,
};
const render = (permissions: string[] = ["warehouse.reservations.read"]) =>
  baseRender(
    <ChakraProvider value={defaultSystem}>
      <WarehouseReservationsPage userPermissions={permissions} />
    </ChakraProvider>,
  );
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(warehouseReservationsApi.orders).mockResolvedValue(page);
});
afterEach(cleanup);

it("shows orders, position counts and independent order/coverage states", async () => {
  render();
  expect(await screen.findByText("202")).toBeInTheDocument();
  expect(screen.getByText("Монтаж")).toBeInTheDocument();
  expect(screen.queryByText("Закрыт")).not.toBeInTheDocument();
  expect(screen.getByText("Есть дефицит")).toBeInTheDocument();
  expect(screen.getByText("3")).toBeInTheDocument();
  const [params, signal] = vi.mocked(warehouseReservationsApi.orders).mock
    .calls[0];
  expect(params.get("coverage")).toBe("ALL");
  expect(params.get("limit")).toBe("50");
  expect(signal).toBeInstanceOf(AbortSignal);
});
it("debounces server search and does not filter the loaded result in the browser", async () => {
  render();
  await screen.findByText("202");
  fireEvent.change(
    screen.getByRole("searchbox", {
      name: "Поиск по заказу, артикулу и наименованию товара",
    }),
    { target: { value: "6205" } },
  );
  await waitFor(() =>
    expect(warehouseReservationsApi.orders).toHaveBeenLastCalledWith(
      expect.any(URLSearchParams),
      expect.any(AbortSignal),
    ),
  );
  await waitFor(() =>
    expect(
      vi
        .mocked(warehouseReservationsApi.orders)
        .mock.calls.at(-1)?.[0]
        .get("search"),
    ).toBe("6205"),
  );
  expect(await screen.findByText("202")).toBeInTheDocument();
});
it("uses the shared filter dialog, resets the filter and requests the first page", async () => {
  render();
  await screen.findByText("202");
  fireEvent.click(
    screen.getByRole("button", { name: "Настройки поиска резервов" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Обеспеченность" }));
  fireEvent.click(await screen.findByRole("option", { name: "С дефицитом" }));
  await waitFor(() =>
    expect(
      vi
        .mocked(warehouseReservationsApi.orders)
        .mock.calls.at(-1)?.[0]
        .get("coverage"),
    ).toBe("DEFICIT"),
  );
  expect(
    vi
      .mocked(warehouseReservationsApi.orders)
      .mock.calls.at(-1)?.[0]
      .get("page"),
  ).toBe("1");
  fireEvent.click(screen.getByRole("button", { name: "Сбросить" }));
  await waitFor(() =>
    expect(
      vi
        .mocked(warehouseReservationsApi.orders)
        .mock.calls.at(-1)?.[0]
        .get("coverage"),
    ).toBe("ALL"),
  );
});
it("denies the page without issuing any API request", async () => {
  render([]);
  expect(screen.getByRole("alert")).toHaveTextContent("Недостаточно прав");
  expect(warehouseReservationsApi.orders).not.toHaveBeenCalled();
  expect(resolveAppRoute("#/warehouse/reservations")).toEqual({
    kind: "warehouse-reservations",
  });
  expect(
    canAccessWorkspaceRoute(
      ["warehouse.reservations.read"],
      "#/warehouse/reservations",
    ),
  ).toBe(true);
  expect(
    canAccessWorkspaceRoute(
      ["warehouse.stock.read"],
      "#/warehouse/reservations",
    ),
  ).toBe(false);
});
it("loads the next server page and retains previously loaded orders", async () => {
  vi.mocked(warehouseReservationsApi.orders)
    .mockResolvedValueOnce({ ...page, total: 51 })
    .mockResolvedValueOnce({
      ...page,
      page: 2,
      total: 51,
      items: [{ ...row, order: { ...row.order, id: "b", number: "285" } }],
    });
  render();
  await screen.findByText("202");
  fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
  expect(await screen.findByText("285")).toBeInTheDocument();
  expect(screen.getByText("202")).toBeInTheDocument();
  expect(
    vi
      .mocked(warehouseReservationsApi.orders)
      .mock.calls.at(-1)?.[0]
      .get("page"),
  ).toBe("2");
});
it("shows a load failure and retries, then shows the empty state", async () => {
  vi.mocked(warehouseReservationsApi.orders).mockRejectedValueOnce(
    new Error("Нет связи"),
  );
  render();
  expect(await screen.findByRole("alert")).toHaveTextContent("Нет связи");
  vi.mocked(warehouseReservationsApi.orders).mockResolvedValue({
    ...page,
    items: [],
    total: 0,
  });
  fireEvent.click(screen.getByRole("button", { name: "Повторить загрузку" }));
  expect(
    await screen.findByText("Заказов с резервами пока нет."),
  ).toBeInTheDocument();
});
