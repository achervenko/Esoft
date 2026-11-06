import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useReceiptStorage } from "./useReceiptStorage";
import { warehousesApi } from "../../shared/api/warehouses-api";
import { storageLocationsApi } from "../../shared/api/storage-locations-api";
vi.mock("../../shared/api/warehouses-api", () => ({
  warehousesApi: { list: vi.fn() },
}));
vi.mock("../../shared/api/storage-locations-api", () => ({
  storageLocationsApi: { list: vi.fn() },
}));
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(warehousesApi.list).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    limit: 100,
  });
  vi.mocked(storageLocationsApi.list).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    limit: 100,
  });
});
it("clears a location failure when another warehouse is selected", async () => {
  vi.mocked(storageLocationsApi.list).mockRejectedValueOnce(
    new Error("Locations failed"),
  );
  const { result, rerender } = renderHook((id) => useReceiptStorage(id), {
    initialProps: "A",
  });
  await waitFor(() => expect(result.current.error).toBe("Locations failed"));
  rerender("B");
  await waitFor(() =>
    expect(storageLocationsApi.list).toHaveBeenCalledTimes(2),
  );
  expect(result.current.error).toBeNull();
});
it("does not hide a warehouse failure after a successful location reload", async () => {
  vi.mocked(warehousesApi.list).mockRejectedValueOnce(
    new Error("Warehouses failed"),
  );
  const { result, rerender } = renderHook((id) => useReceiptStorage(id), {
    initialProps: "A",
  });
  await waitFor(() => expect(result.current.error).toBe("Warehouses failed"));
  rerender("B");
  await waitFor(() =>
    expect(storageLocationsApi.list).toHaveBeenCalledTimes(2),
  );
  expect(result.current.error).toBe("Warehouses failed");
});
it("keeps the location failure when retrying warehouse loading successfully", async () => {
  vi.mocked(warehousesApi.list).mockRejectedValueOnce(
    new Error("Warehouses failed"),
  );
  vi.mocked(storageLocationsApi.list).mockRejectedValueOnce(
    new Error("Locations failed"),
  );
  const { result, rerender } = renderHook(
    (activeOnly) => useReceiptStorage("A", activeOnly),
    { initialProps: true },
  );
  await waitFor(() => expect(result.current.error).toBe("Warehouses failed"));
  rerender(false);
  await waitFor(() => expect(warehousesApi.list).toHaveBeenCalledTimes(2));
  expect(result.current.error).toBe("Locations failed");
});
