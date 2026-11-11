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
vi.mock("../../shared/api/warehouse-reservations-api", () => ({
  warehouseReservationsApi: { reduceCoverage: vi.fn(), decrease: vi.fn() },
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
  sessionStorage.clear();
});
afterEach(cleanup);
it("submits coverage reduction through common fields and keeps the form open on a backend conflict", async () => {
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
  fireEvent.change(screen.getByLabelText(/Количество/), {
    target: { value: "2,125" },
  });
  fireEvent.change(screen.getByLabelText(/Комментарий/), {
    target: { value: "Пересмотр обеспечения" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await screen.findByText("Недостаточно обеспеченного количества");
  expect(saved).not.toHaveBeenCalled();
  expect(api.reduceCoverage).toHaveBeenCalledWith(row.id, {
    locationId: "1",
    quantity: "2.125",
    comment: "Пересмотр обеспечения",
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Обновить данные резервов" }),
  );
  expect(refresh).toHaveBeenCalledOnce();
});
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
