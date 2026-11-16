import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReservationOperationForm } from "./ReservationOperationForm";
import { warehouseReservationsApi as api } from "../../shared/api/warehouse-reservations-api";
import { row, order } from "./reservation-modal-test-utils";
import { warehouseCatalogApi } from "../../shared/api/warehouse-catalog-api";
const placesState = vi.hoisted(() => ({
  error: null as string | null,
  placeMissing: false,
  retry: vi.fn(),
}));
vi.mock("../../shared/api/warehouse-reservations-api", () => ({
  warehouseReservationsApi: {
    reduceCoverage: vi.fn(),
    decrease: vi.fn(),
    reserve: vi.fn(),
  },
}));
vi.mock("./useReservationPlaces", () => ({
  useReservationPlaces: () => ({
    locations: placesState.placeMissing ? [] : [row.allocations[0].location],
    free: { "1": "3" },
    loading: false,
    error: placesState.error,
    retry: placesState.retry,
  }),
}));
vi.mock("../../shared/warehouse/useStorageChoices", () => ({
  useStorageChoices: () => ({
    locations: [],
    loading: false,
    error: null,
    retry: vi.fn(),
  }),
}));
beforeEach(() => {
  vi.resetAllMocks();
  placesState.error = null;
  placesState.placeMissing = false;
  sessionStorage.clear();
});
afterEach(cleanup);
it.each([
  ["10", false, "available"],
  ["3", true, "available"],
  ["3", false, "failed"],
  ["3", false, "missing"],
])(
  "creates a reserve for %s with coverage %s when the place is %s",
  async (quantity, covered, placeState) => {
    const list = vi.spyOn(warehouseCatalogApi, "list").mockResolvedValue({
      items: [{ ...row.item, comment: null }],
      total: 1,
      limit: 50,
      offset: 0,
    });
    try {
      vi.mocked(api.reserve).mockResolvedValue(row);
      const renderForm = () => (
        <ChakraProvider value={defaultSystem}>
          <ReservationOperationForm
            operation={{ kind: "reserve" }}
            orderId={order.id}
            onClose={vi.fn()}
            onSaved={vi.fn()}
            onRefresh={vi.fn()}
          />
        </ChakraProvider>
      );
      const view = render(renderForm());
      expect(
        screen.queryByRole("combobox", { name: "Место хранения" }),
      ).toBeNull();
      fireEvent.focus(screen.getByRole("combobox", { name: "Номенклатура" }));
      fireEvent.click(
        await screen.findByRole("option", { name: new RegExp(row.item.name) }),
      );
      fireEvent.change(screen.getByLabelText(/Потребность/), {
        target: { value: quantity },
      });
      fireEvent.click(screen.getByRole("combobox", { name: "Место хранения" }));
      fireEvent.click(await screen.findByRole("option", { name: /А-02/ }));
      if (placeState !== "available") {
        placesState.placeMissing = placeState === "missing";
        placesState.error =
          placeState === "failed" ? "Не удалось загрузить остатки" : null;
        view.rerender(renderForm());
        if (placesState.placeMissing) {
          expect(
            screen.getByText(/Выбранного места больше нет в остатках/),
          ).toBeVisible();
        }
        expect(
          screen.getByRole("button", { name: "Сохранить" }),
        ).toBeDisabled();
        fireEvent.submit(
          screen.getByRole("button", { name: "Сохранить" }).closest("form")!,
        );
        expect(api.reserve).not.toHaveBeenCalled();
        fireEvent.click(
          screen.getByRole("button", { name: "Повторить загрузку мест" }),
        );
        expect(placesState.retry).toHaveBeenCalledOnce();
        fireEvent.click(screen.getByRole("button", { name: "Очистить место" }));
      }
      expect(screen.getByRole("status")).toHaveTextContent(
        covered
          ? "Будет зарезервировано 3 шт"
          : `дефицит составит ${quantity} шт`,
      );
      fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
      await waitFor(() => expect(api.reserve).toHaveBeenCalledOnce());
      const payload = vi.mocked(api.reserve).mock.calls[0][0];
      expect(payload.quantity).toBe(quantity);
      if (covered) expect(payload.locationId).toBe("1");
      else expect(payload).not.toHaveProperty("locationId");
    } finally {
      list.mockRestore();
    }
  },
);
it.each([
  ["5,875", "2.125"],
  ["0", "8"],
])(
  "sets coverage to %s and sends a reduction of %s",
  async (remaining, reduction) => {
    vi.mocked(api.reduceCoverage).mockRejectedValue(
      new Error("Недостаточно обеспеченного количества"),
    );
    const saved = vi.fn(),
      refresh = vi.fn();
    render(
      <ChakraProvider value={defaultSystem}>
        <ReservationOperationForm
          operation={{ kind: "reduce", reservation: row, locationId: "1" }}
          orderId={order.id}
          onClose={vi.fn()}
          onSaved={saved}
          onRefresh={refresh}
        />
      </ChakraProvider>,
    );
    const quantity = screen.getByLabelText(/Оставить обеспеченным/);
    expect(quantity).toHaveValue("8");
    fireEvent.change(quantity, {
      target: { value: remaining },
    });
    fireEvent.change(screen.getByLabelText(/Комментарий/), {
      target: { value: "Пересмотр обеспечения" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    await screen.findByText("Недостаточно обеспеченного количества");
    expect(saved).not.toHaveBeenCalled();
    expect(api.reduceCoverage).toHaveBeenCalledWith(row.id, {
      locationId: "1",
      quantity: reduction,
      expectedQuantity: "8",
      comment: "Пересмотр обеспечения",
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Обновить данные резервов" }),
    );
    expect(refresh).toHaveBeenCalledOnce();
  },
);
it("previews and submits quantities freed from places and deficit", async () => {
  vi.mocked(api.decrease).mockResolvedValue(row);
  const saved = vi.fn();
  render(
    <ChakraProvider value={defaultSystem}>
      <ReservationOperationForm
        operation={{ kind: "decrease", reservation: row }}
        orderId={order.id}
        onClose={vi.fn()}
        onSaved={saved}
        onRefresh={vi.fn()}
      />
    </ChakraProvider>,
  );
  fireEvent.change(screen.getByLabelText(/Склад 1 — А-02/), {
    target: { value: "1" },
  });
  fireEvent.change(screen.getByLabelText(/Снять из дефицита/), {
    target: { value: "0,125" },
  });
  fireEvent.change(screen.getByLabelText(/Комментарий/), {
    target: { value: "Заказ уменьшен" },
  });
  expect(screen.getByText(/Потребность уменьшится на 1,125/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
});

it("switches from editing coverage to reducing the order demand in the same modal", async () => {
  vi.mocked(api.decrease).mockResolvedValue(row);
  render(
    <ChakraProvider value={defaultSystem}>
      <ReservationOperationForm
        operation={{
          kind: "reduce",
          reservation: row,
          locationId: "1",
          canDecrease: true,
        }}
        orderId={order.id}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onRefresh={vi.fn()}
      />
    </ChakraProvider>,
  );
  expect(screen.getByLabelText(/Оставить обеспеченным/)).toHaveValue("8");
  fireEvent.click(screen.getByRole("button", { name: "Операция" }));
  fireEvent.click(
    await screen.findByRole("option", {
      name: "Изменить потребность",
    }),
  );
  fireEvent.change(screen.getByLabelText(/Потребность,/), {
    target: { value: "9,125" },
  });
  fireEvent.change(screen.getByLabelText(/Комментарий/), {
    target: { value: "Потребность снизилась" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await waitFor(() =>
    expect(api.decrease).toHaveBeenCalledWith(row.id, {
      allocations: [],
      deficitQuantity: "1",
      expectedQuantity: row.quantity,
      comment: "Потребность снизилась",
    }),
  );
  expect(api.reduceCoverage).not.toHaveBeenCalled();
});
