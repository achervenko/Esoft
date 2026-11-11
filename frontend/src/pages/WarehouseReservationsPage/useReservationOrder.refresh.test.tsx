import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useReservationOrder } from "./useReservationOrder";
import { warehouseReservationsApi as api } from "../../shared/api/warehouse-reservations-api";
import { row, order } from "./reservation-modal-test-utils";
vi.mock("../../shared/api/warehouse-reservations-api", () => ({
  warehouseReservationsApi: { summary: vi.fn(), list: vi.fn() },
}));
afterEach(cleanup);
it("refreshes counters and rows without losing search or deficit conditions", async () => {
  vi.mocked(api.summary).mockResolvedValue({
    order,
    positionsCount: 1,
    deficitPositionsCount: 1,
  });
  vi.mocked(api.list).mockResolvedValue({
    items: [row],
    total: 1,
    page: 1,
    limit: 50,
  });
  const { result } = renderHook(() => useReservationOrder(order.id));
  await waitFor(() => expect(result.current.list.data?.items).toHaveLength(1));
  act(() => {
    result.current.setSearch("6205");
    result.current.setDeficitOnly(true);
  });
  await waitFor(() =>
    expect(api.list).toHaveBeenLastCalledWith(
      expect.any(URLSearchParams),
      expect.any(AbortSignal),
    ),
  );
  await waitFor(() =>
    expect(vi.mocked(api.list).mock.calls.at(-1)?.[0].get("search")).toBe(
      "6205",
    ),
  );
  const key = result.current.queryKey;
  vi.mocked(api.summary).mockResolvedValue({
    order,
    positionsCount: 0,
    deficitPositionsCount: 0,
  });
  vi.mocked(api.list).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    limit: 50,
  });
  act(() => result.current.refresh());
  await waitFor(() => expect(result.current.summary?.positionsCount).toBe(0));
  await waitFor(() => expect(result.current.list.data?.items).toHaveLength(0));
  expect(result.current.search).toBe("6205");
  expect(result.current.deficitOnly).toBe(true);
  expect(result.current.queryKey).toBe(key);
  expect(vi.mocked(api.list).mock.calls.at(-1)?.[0].get("deficit")).toBe(
    "true",
  );
});
