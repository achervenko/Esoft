import { StockDistributionTable } from "./StockDistributionTable";
import { distribution, render } from "./stock-page-test-context";
import {
  act,
  cleanup,
  renderHook,
  waitFor,
  screen,
  fireEvent,
  within,
} from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { warehouseStockApi } from "../../shared/api/warehouse-stock-api";
import { useStockTransferForm } from "./useStockTransferForm";
import { ApiRequestError } from "../../shared/api/api-error";
const source = {
  ...distribution.locations[0],
  quantity: "12",
  freeQuantity: "5",
  reservedQuantity: "7",
  reservations: [
    {
      reservationId: "first",
      order: { id: "a", number: "202", name: "Монтаж" },
      quantity: "4",
    },
    {
      reservationId: "second",
      order: { id: "b", number: "203", name: "Ремонт" },
      quantity: "3",
    },
  ],
};
const data = {
  ...distribution,
  locations: [source, distribution.locations[1]],
};
const event = { preventDefault: vi.fn() } as unknown as React.FormEvent;
it("moves only the selected reservation and limits quantity to that row", async () => {
  const { result } = renderHook(() =>
    useStockTransferForm({
      data,
      source,
      reservationId: "first",
      canMoveReservations: true,
      onSaved: vi.fn(),
    }),
  );
  await waitFor(() => expect(result.current.choices.loading).toBe(false));
  act(() => {
    result.current.setLocationId(distribution.locations[1].location.id);
    result.current.setQuantity("5");
  });
  expect(result.current.valid).toBe(false);
  act(() => result.current.setQuantity("4"));
  await act(() => result.current.submit(event));
  expect(warehouseStockApi.transfer).toHaveBeenCalledWith(
    expect.objectContaining({
      quantity: "4",
      distribution: {
        freeQuantity: "0",
        reservations: [{ reservationId: "first", quantity: "4" }],
      },
    }),
  );
});
it("moves a free row without reserving stock and rejects unauthorized reserved moves", async () => {
  const { result, rerender } = renderHook(
    ({ reservationId }) =>
      useStockTransferForm({ data, source, reservationId, onSaved: vi.fn() }),
    { initialProps: { reservationId: undefined as string | undefined } },
  );
  await waitFor(() => expect(result.current.choices.loading).toBe(false));
  act(() => {
    result.current.setLocationId(distribution.locations[1].location.id);
    result.current.setQuantity("6");
  });
  expect(result.current.valid).toBe(false);
  act(() => result.current.setQuantity("4"));
  expect(result.current.valid).toBe(true);
  rerender({ reservationId: "first" });
  expect(result.current.valid).toBe(false);
});
it("restores the selected reserved row and exact request after a lost response", async () => {
  vi.mocked(warehouseStockApi.transfer)
    .mockRejectedValueOnce(new Error("Ответ потерян"))
    .mockRejectedValueOnce(
      new ApiRequestError(
        "Недостаточно резерва",
        409,
        "WAREHOUSE_RESERVATION_ALLOCATION_INSUFFICIENT",
      ),
    );
  const options = {
    data,
    source,
    reservationId: "first",
    canMoveReservations: true,
    onSaved: vi.fn(),
  };
  const first = renderHook(() => useStockTransferForm(options));
  await waitFor(() => expect(first.result.current.choices.loading).toBe(false));
  act(() => {
    first.result.current.setLocationId(distribution.locations[1].location.id);
    first.result.current.setQuantity("3");
  });
  await act(() => first.result.current.submit(event));
  const input = vi.mocked(warehouseStockApi.transfer).mock.calls[0][0];
  expect(first.result.current.locked).toBe(true);
  first.unmount();
  const retry = renderHook(() => useStockTransferForm(options));
  await act(() => retry.result.current.submit(event));
  expect(warehouseStockApi.transfer).toHaveBeenLastCalledWith(input);
  expect(retry.result.current.locked).toBe(false);
  expect(retry.result.current.selectedReservation?.reservationId).toBe("first");
  cleanup();
});

it("shows free stock and each order as separate rows and opens the exact selected reserve", () => {
  const onTransfer = vi.fn();
  render(
    <StockDistributionTable
      data={{ ...data, locations: [source] }}
      loading={false}
      error={null}
      canTransfer
      canAdjust
      canMoveReservations
      onTransfer={onTransfer}
      onAdjust={vi.fn()}
    />,
  );
  expect(screen.getAllByRole("row")).toHaveLength(4);
  const reserved = screen.getByText(/Резерв: 202/).closest("tr")!;
  expect(within(reserved).getByText("4 шт")).toBeVisible();
  fireEvent.click(
    within(reserved).getByRole("button", { name: "Переместить" }),
  );
  expect(onTransfer).toHaveBeenCalledWith({
    balance: source,
    reservationId: "first",
  });
  expect(screen.queryByText("Свободно")).not.toBeInTheDocument();
  expect(screen.queryByText("Состав перемещения")).not.toBeInTheDocument();
});
