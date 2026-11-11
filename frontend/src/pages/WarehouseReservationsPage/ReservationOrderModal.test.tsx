import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  screen,
  within,
  waitFor,
  act,
} from "@testing-library/react";
import { warehouseReservationsApi } from "../../shared/api/warehouse-reservations-api";
import { resolveAppRoute } from "../../layouts/app-router";
import { canAccessWorkspaceRoute } from "../../lib/role-navigation";

vi.mock("../../shared/api/warehouse-reservations-api", () => ({
  warehouseReservationsApi: {
    orders: vi.fn(),
    summary: vi.fn(),
    list: vi.fn(),
  },
}));
import {
  id,
  row,
  order,
  mount,
  setupReservationModal,
} from "./reservation-modal-test-utils";
beforeEach(setupReservationModal);
afterEach(cleanup);

it("routes to an order, loads positive reserves with read permission and keeps decimal quantities", async () => {
  window.location.hash = "/warehouse/reservations";
  expect(resolveAppRoute(`#/warehouse/reservations/${id}`)).toEqual({
    kind: "unknown",
  });
  expect(
    canAccessWorkspaceRoute(
      ["warehouse.reservations.read"],
      "#/warehouse/reservations",
    ),
  ).toBe(true);
  expect(canAccessWorkspaceRoute([], "#/warehouse/reservations")).toBe(false);
  await mount();
  expect(await screen.findByText("Подшипник")).toBeInTheDocument();
  expect(
    screen.getByRole("dialog", { name: "Заказ №202" }),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole("dialog")).getByText("Закрыт"),
  ).toBeInTheDocument();
  expect(screen.getByText("8 / 10,125 шт")).toBeInTheDocument();
  expect(screen.getByText("Дефицит 2,125 шт")).toBeInTheDocument();
  expect(window.location.hash).toBe("#/warehouse/reservations");
  expect(screen.queryByRole("link", { name: "Назад" })).not.toBeInTheDocument();
  const [params] = vi.mocked(warehouseReservationsApi.list).mock.calls[0];
  expect(params.get("orderId")).toBe(id);
  expect(params.get("quantityState")).toBe("POSITIVE");
  expect(warehouseReservationsApi.orders).toHaveBeenCalledTimes(1);
});

it("opens shared modal with reserve product summary and positive allocations only", async () => {
  await mount();
  const originalDialog = screen.getByRole("dialog", { name: "Заказ №202" });
  fireEvent.click(
    await screen.findByRole("button", { name: /Подшипник.*6205/ }),
  );
  const dialog = screen.getByRole("dialog", { name: "Заказ №202" });
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(dialog).toBe(originalDialog);
  expect(within(dialog).getByText("8 шт")).toBeInTheDocument();
  expect(within(dialog).getByText("А-02")).toBeInTheDocument();
  expect(within(dialog).queryByText("Нулевое место")).not.toBeInTheDocument();
  expect(within(dialog).getByText("Не обеспечено")).toBeInTheDocument();
  expect(warehouseReservationsApi.list).toHaveBeenCalledTimes(1);
  fireEvent.click(
    within(dialog).getByRole("button", { name: /Подшипник.*6205/ }),
  );
  expect(within(dialog).queryByText("А-02")).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Закрыть" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /Позиции заказа 202:/ }),
  ).toBeInTheDocument();
});

it("shows an unallocated reserve and a fully covered reserve without inventing locations", async () => {
  vi.mocked(warehouseReservationsApi.list).mockResolvedValue({
    items: [
      {
        ...row,
        coveredQuantity: "0",
        deficitQuantity: "10.125",
        allocations: [],
      },
      {
        ...row,
        id: "r2",
        item: { ...row.item, article: "FL", name: "Фланец", unit: "м" },
        quantity: "3",
        coveredQuantity: "3",
        deficitQuantity: "0",
        allocations: [{ ...row.allocations[0], quantity: "3" }],
      },
    ],
    total: 2,
    page: 1,
    limit: 50,
  });
  await mount();
  fireEvent.click(
    await screen.findByRole("button", { name: /Подшипник.*6205/ }),
  );
  expect(
    within(screen.getByRole("dialog")).getByText("Не обеспечено"),
  ).toBeInTheDocument();
  expect(screen.getByText("3 м")).toBeInTheDocument();
  expect(screen.getByText("Обеспечен")).toBeInTheDocument();
});

it("retries summary failures, handles empty orders, and blocks unauthorized reads", async () => {
  vi.mocked(warehouseReservationsApi.summary).mockRejectedValueOnce(
    new Error("Заказ не найден"),
  );
  vi.mocked(warehouseReservationsApi.list).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    limit: 50,
  });
  await mount();
  await screen.findByText("Заказ не найден");
  expect(warehouseReservationsApi.list).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
  expect(
    await screen.findByText("У заказа нет действующих резервов."),
  ).toBeInTheDocument();
  cleanup();
  vi.clearAllMocks();
  await mount([]);
  expect(
    screen.getByText("Недостаточно прав для просмотра резервов."),
  ).toBeInTheDocument();
  expect(warehouseReservationsApi.summary).not.toHaveBeenCalled();
});

it("retries reserve loading without reloading order metadata", async () => {
  vi.mocked(warehouseReservationsApi.list).mockRejectedValueOnce(
    new Error("Ошибка загрузки"),
  );
  await mount();
  await screen.findByText("Ошибка загрузки");
  fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
  await screen.findByText("Подшипник");
  expect(warehouseReservationsApi.summary).toHaveBeenCalledTimes(1);
  await waitFor(() =>
    expect(warehouseReservationsApi.list).toHaveBeenCalledTimes(2),
  );
});

it("loads subsequent server pages and preserves order-wide counters", async () => {
  vi.mocked(warehouseReservationsApi.summary).mockResolvedValue({
    order,
    positionsCount: 51,
    deficitPositionsCount: 1,
  });
  vi.mocked(warehouseReservationsApi.list)
    .mockResolvedValueOnce({ items: [row], total: 51, page: 1, limit: 50 })
    .mockResolvedValueOnce({
      items: [
        {
          ...row,
          id: "r2",
          item: { ...row.item, article: "FL", name: "Фланец" },
        },
      ],
      total: 51,
      page: 2,
      limit: 50,
    });
  await mount();
  fireEvent.click(await screen.findByRole("button", { name: "Показать ещё" }));
  await screen.findByText("Фланец");
  expect(screen.getByText("Подшипник")).toBeInTheDocument();
  expect(screen.queryByText(/Показано/)).not.toBeInTheDocument();
  const [query] = vi.mocked(warehouseReservationsApi.list).mock.calls[1];
  expect(query.get("page")).toBe("2");
  expect(query.get("orderId")).toBe(id);
});

it("opens from positions without navigation and preserves search when closed", async () => {
  await mount();
  fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
  const search = screen.getByRole("searchbox");
  fireEvent.change(search, { target: { value: "Монтаж" } });
  await waitFor(() =>
    expect(
      vi
        .mocked(warehouseReservationsApi.orders)
        .mock.calls.at(-1)?.[0]
        .get("search"),
    ).toBe("Монтаж"),
  );
  const hash = window.location.hash;
  fireEvent.click(screen.getByRole("button", { name: /Позиции заказа 202:/ }));
  await screen.findByRole("dialog", { name: "Заказ №202" });
  expect(window.location.hash).toBe(hash);
  fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
  expect(search).toHaveValue("Монтаж");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("cancels a pending order load on closing the modal", async () => {
  vi.mocked(warehouseReservationsApi.summary).mockReturnValue(
    new Promise(() => {}),
  );
  await mount();
  const [, signal] = vi.mocked(warehouseReservationsApi.summary).mock.calls[0];
  expect(signal?.aborted).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
  expect(signal?.aborted).toBe(true);
  expect(warehouseReservationsApi.list).not.toHaveBeenCalled();
});

it("uses the shared modal resize animation when a reserve expands", async () => {
  const animateDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "animate",
  );
  const animation = { cancel: vi.fn(), onfinish: null as null | (() => void) };
  const animate = vi.fn(() => animation);
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: animate,
  });
  const rect = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: HTMLElement) {
      return {
        height: this.classList.contains("admin-modal")
          ? this.querySelector('.reservation-item-button[aria-expanded="true"]')
            ? 540
            : 400
          : 0,
        width: 0,
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        x: 0,
        y: 0,
        toJSON() {},
      } as DOMRect;
    });
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: () => true,
  }));
  try {
    await mount();
    const button = await screen.findByRole("button", {
      name: /Подшипник.*6205/,
    });
    fireEvent.click(button);
    expect(animate).toHaveBeenCalledWith(
      [{ height: "400px" }, { height: "540px" }],
      expect.objectContaining({ duration: 360 }),
    );
    expect(screen.getByRole("dialog")).toHaveClass("admin-modal-resizing");
    act(() => animation.onfinish?.());
    expect(screen.getByRole("dialog")).not.toHaveClass("admin-modal-resizing");
  } finally {
    cleanup();
    rect.mockRestore();
    vi.unstubAllGlobals();
    if (animateDescriptor)
      Object.defineProperty(
        HTMLElement.prototype,
        "animate",
        animateDescriptor,
      );
    else Reflect.deleteProperty(HTMLElement.prototype, "animate");
  }
});
