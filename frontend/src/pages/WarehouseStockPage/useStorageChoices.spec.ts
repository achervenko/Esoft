import { warehouseStockApi } from "../../shared/api/warehouse-stock-api";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useStorageChoices } from "./useStorageChoices";

vi.mock("../../shared/api/warehouse-stock-api", () => ({
  warehouseStockApi: { warehouses: vi.fn(), storageLocations: vi.fn() },
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("returns idle state without requests when disabled initially", () => {
  const { result } = renderHook(() => useStorageChoices(false, ""));
  expect(result.current).toMatchObject({
    warehouses: [],
    locations: [],
    loading: false,
    error: null,
  });
  expect(warehouseStockApi.warehouses).not.toHaveBeenCalled();
  expect(warehouseStockApi.storageLocations).not.toHaveBeenCalled();
});

it("hides previous errors when disabled", async () => {
  vi.mocked(warehouseStockApi.warehouses).mockRejectedValue(
    new Error("Load failed"),
  );
  vi.mocked(warehouseStockApi.storageLocations).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    limit: 100,
  });
  const { result, rerender } = renderHook(
    ({ enabled }) => useStorageChoices(enabled, ""),
    { initialProps: { enabled: true } },
  );
  await waitFor(() => expect(result.current.error).toBeTruthy());
  rerender({ enabled: false });
  expect(result.current.error).toBeNull();
  expect(result.current.loading).toBe(false);
});
