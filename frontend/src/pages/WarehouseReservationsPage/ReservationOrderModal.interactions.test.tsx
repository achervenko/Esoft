import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { warehouseReservationsApi } from "../../shared/api/warehouse-reservations-api";
import {
  id,
  row,
  order,
  mount,
  setupReservationModal,
} from "./reservation-modal-test-utils";

vi.mock("../../shared/api/warehouse-reservations-api", () => ({
  warehouseReservationsApi: {
    orders: vi.fn(),
    summary: vi.fn(),
    list: vi.fn(),
  },
}));
beforeEach(setupReservationModal);
afterEach(cleanup);

it("expands several reserves inline and collapses them individually without requests", async () => {
  const second = {
    ...row,
    id: "r2",
    item: { ...row.item, name: "Фланец", article: "FL" },
    allocations: [
      {
        ...row.allocations[0],
        id: "b",
        location: { ...row.allocations[0].location, name: "Б-02" },
      },
    ],
  };
  vi.mocked(warehouseReservationsApi.list).mockResolvedValue({
    items: [row, second],
    total: 2,
    page: 1,
    limit: 50,
  });
  await mount();
  fireEvent.click(
    await screen.findByRole("button", { name: /Подшипник.*6205/ }),
  );
  fireEvent.click(screen.getByRole("button", { name: /Фланец.*FL/ }));
  expect(screen.getByText("А-02")).toBeInTheDocument();
  expect(screen.getByText("Б-02")).toBeInTheDocument();
  expect(screen.getAllByText("Не обеспечено")).toHaveLength(2);
  expect(screen.queryByText(/Развёрнуто/)).not.toBeInTheDocument();
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(warehouseReservationsApi.list).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: /Подшипник.*6205/ }));
  fireEvent.click(screen.getByRole("button", { name: /Фланец.*FL/ }));
  expect(screen.queryByText("А-02")).not.toBeInTheDocument();
  expect(screen.queryByText("Б-02")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Свернуть все" }),
  ).not.toBeInTheDocument();
});

it("searches every server page by article/name and combines deficit filter without replacing order counters", async () => {
  await mount();
  const dialog = screen.getByRole("dialog");
  const search = within(dialog).getByRole("searchbox");
  await screen.findByRole("button", { name: /Подшипник.*6205/ });
  fireEvent.click(screen.getByRole("button", { name: /Подшипник.*6205/ }));
  vi.mocked(warehouseReservationsApi.list).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    limit: 50,
  });
  fireEvent.change(search, { target: { value: "ФЛАНЕЦ" } });
  await screen.findByText("Ничего не найдено");
  expect(
    vi
      .mocked(warehouseReservationsApi.list)
      .mock.calls.at(-1)?.[0]
      .get("search"),
  ).toBe("ФЛАНЕЦ");
  expect(screen.queryByText("А-02")).not.toBeInTheDocument();
  fireEvent.click(
    within(dialog).getByRole("button", {
      name: "Настройки поиска номенклатуры",
    }),
  );
  const settings = screen.getByRole("dialog", { name: "Настройки поиска" });
  fireEvent.click(
    within(settings).getByRole("checkbox", { name: "Только с дефицитом" }),
  );
  expect(within(settings).getByRole("checkbox")).toBeChecked();
  fireEvent.click(within(settings).getByRole("button", { name: "Применить" }));
  await waitFor(() =>
    expect(
      vi
        .mocked(warehouseReservationsApi.list)
        .mock.calls.at(-1)?.[0]
        .get("deficit"),
    ).toBe("true"),
  );
  expect(
    vi.mocked(warehouseReservationsApi.list).mock.calls.at(-1)?.[0].get("page"),
  ).toBe("1");
  expect(within(dialog).queryByText(/с дефицитом/)).not.toBeInTheDocument();
  expect(search).toHaveValue("ФЛАНЕЦ");
  expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
  expect(
    within(dialog).getByRole("button", {
      name: "Настройки поиска номенклатуры",
    }),
  ).toHaveAttribute("aria-expanded", "false");
});

it("resets expansions/search on changing orders and aborts old data reads", async () => {
  const next = {
    ...order,
    id: "ee74aa85-0723-4d2f-bc80-acfc7d8d6703",
    number: "285",
  };
  vi.mocked(warehouseReservationsApi.orders).mockResolvedValue({
    items: [
      { order, positionsCount: 1, deficitPositionsCount: 1 },
      { order: next, positionsCount: 0, deficitPositionsCount: 0 },
    ],
    total: 2,
    page: 1,
    limit: 50,
  });
  await mount();
  fireEvent.click(
    await screen.findByRole("button", { name: /Подшипник.*6205/ }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
  const [, signal] = vi.mocked(warehouseReservationsApi.summary).mock.calls[0];
  expect(signal?.aborted).toBe(true);
  vi.mocked(warehouseReservationsApi.summary).mockResolvedValue({
    order: next,
    positionsCount: 0,
    deficitPositionsCount: 0,
  });
  vi.mocked(warehouseReservationsApi.list).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    limit: 50,
  });
  fireEvent.click(screen.getByRole("button", { name: /Позиции заказа 285:/ }));
  await screen.findByRole("dialog", { name: "Заказ №285" });
  await screen.findByText("У заказа нет действующих резервов.");
  expect(within(screen.getByRole("dialog")).getByRole("searchbox")).toHaveValue(
    "",
  );
  expect(screen.queryByText(/Развёрнуто/)).not.toBeInTheDocument();
  expect(screen.queryByText("Подшипник")).not.toBeInTheDocument();
  expect(
    vi.mocked(warehouseReservationsApi.summary).mock.calls.at(-1)?.[0],
  ).not.toBe(id);
});

it("keeps 500 loaded reserves as logical positions while mounting only a window", async () => {
  const items = Array.from({ length: 500 }, (_, i) => ({
    ...row,
    id: `r${i}`,
    item: { ...row.item, article: `MAT-${i}`, name: `Материал ${i}` },
  }));
  vi.mocked(warehouseReservationsApi.summary).mockResolvedValue({
    order,
    positionsCount: 500,
    deficitPositionsCount: 500,
  });
  vi.mocked(warehouseReservationsApi.list).mockResolvedValue({
    items,
    total: 500,
    page: 10,
    limit: 50,
  });
  await mount();
  await screen.findByRole("button", { name: /Материал 0.*MAT-0/ });
  expect(screen.queryByText(/Показано/)).not.toBeInTheDocument();
  expect(
    within(screen.getByRole("dialog")).getAllByRole("listitem").length,
  ).toBeLessThan(160);
  expect(screen.queryByText("Материал 499")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Материал 0.*MAT-0/ }));
  expect(screen.getByText("А-02")).toBeInTheDocument();
  expect(warehouseReservationsApi.list).toHaveBeenCalledTimes(1);
});
