import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { warehouseStockApi } from "../../shared/api/warehouse-stock-api";
import { useReservationPlaces } from "./useReservationPlaces";
vi.mock("../../shared/api/warehouse-stock-api", () => ({
  warehouseStockApi: { balances: vi.fn() },
}));
const location = {
  id: "1",
  name: "А-01",
  warehouseId: "w",
  isActive: true,
  warehouse: { id: "w", name: "Склад", isActive: true },
};
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
it("does not load any places before item selection and queries only positive active balances of that item", async () => {
  vi.mocked(warehouseStockApi.balances).mockResolvedValue({
    items: [{ location, quantity: "1", freeQuantity: "1" }],
    total: 1,
    page: 1,
    limit: 100,
  });
  const { result, rerender } = renderHook(
    ({ id }) => useReservationPlaces(id, true),
    { initialProps: { id: "" } },
  );
  expect(warehouseStockApi.balances).not.toHaveBeenCalled();
  expect(result.current.locations).toEqual([]);
  rerender({ id: "item" });
  await waitFor(() => expect(result.current.locations).toEqual([location]));
  const query = vi.mocked(warehouseStockApi.balances).mock.calls[0][0];
  expect(query.get("itemId")).toBe("item");
  expect(query.get("quantityState")).toBe("POSITIVE");
  expect(query.get("locationActive")).toBe("true");
});
it("loads all pages and clears old places immediately when changing the item", async () => {
  vi.mocked(warehouseStockApi.balances)
    .mockResolvedValueOnce({
      items: [{ location, quantity: "1", freeQuantity: "0" }],
      total: 2,
      page: 1,
      limit: 1,
    })
    .mockResolvedValueOnce({
      items: [
        {
          location: { ...location, id: "2" },
          quantity: "2",
          freeQuantity: "2",
        },
      ],
      total: 2,
      page: 2,
      limit: 1,
    })
    .mockReturnValue(new Promise(() => {}));
  const { result, rerender } = renderHook(
    ({ id }) => useReservationPlaces(id, true),
    { initialProps: { id: "first" } },
  );
  await waitFor(() => expect(result.current.locations).toHaveLength(2));
  const signal = vi.mocked(warehouseStockApi.balances).mock.calls[0][1];
  act(() => rerender({ id: "second" }));
  expect(signal?.aborted).toBe(true);
  expect(result.current.locations).toEqual([]);
  expect(result.current.loading).toBe(true);
});
