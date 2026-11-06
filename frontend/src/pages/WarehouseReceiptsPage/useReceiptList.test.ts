import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { receiptsApi } from "../../shared/api/warehouse-receipts-api";
import { receipt } from "./receipts-test-context";
import { useReceiptList } from "./useReceiptList";
import { defaultPreferences } from "./receipt-list-preferences";
vi.mock("../../shared/api/warehouse-receipts-api", () => ({
  receiptsApi: { list: vi.fn() },
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(receiptsApi.list).mockResolvedValue({
    items: [receipt],
    total: 1,
    page: 1,
    limit: 50,
  });
});
it.each([
  [defaultPreferences.states, "RECEIVED,PLACING", "false"],
  [["CONFLICT"], "CONFLICT", null],
  [["RECEIVED", "CONFLICT"], "RECEIVED,CONFLICT", null],
  [[], "RECEIVED,PLACING,PLACED,CANCELLED", null],
])(
  "preserves the virtual conflict contract for %j",
  async (states, status, conflict) => {
    const { result } = renderHook(() =>
      useReceiptList({ ...defaultPreferences, states }),
    );
    await waitFor(() => expect(result.current.query.loading).toBe(false));
    const params = vi.mocked(receiptsApi.list).mock.calls[0][0];
    expect(params.get("status")).toBe(status);
    expect(params.get("hasConflict")).toBe(conflict);
    expect(params.get("sortBy")).toBe("receivedAt");
  },
);
it("passes server filters and sorting and blocks invalid date ranges", async () => {
  const preferences = {
    ...defaultPreferences,
    warehouseId: "2",
    source: "ONE_C",
    problems: "ITEMS",
    documentDateFrom: "2026-10-01",
    documentDateTo: "2026-10-31",
    sort: { key: "documentNumber", direction: "asc" } as const,
  };
  const { result, rerender } = renderHook((p) => useReceiptList(p), {
    initialProps: preferences,
  });
  await waitFor(() => expect(result.current.query.loading).toBe(false));
  const params = vi.mocked(receiptsApi.list).mock.calls[0][0];
  expect(Object.fromEntries(params)).toMatchObject({
    warehouseId: "2",
    source: "ONE_C",
    attention: "ITEMS",
    documentDateFrom: "2026-10-01",
    documentDateTo: "2026-10-31",
    sortBy: "documentNumber",
    sortOrder: "asc",
  });
  rerender({ ...preferences, documentDateFrom: "2026-11-01" });
  expect(result.current.invalidPeriod).toBe(true);
  expect(receiptsApi.list).toHaveBeenCalledTimes(1);
});
it("debounces and trims search for 250ms", async () => {
  vi.useFakeTimers();
  const { rerender } = renderHook((p) => useReceiptList(p), {
    initialProps: defaultPreferences,
  });
  await act(async () => {
    await Promise.resolve();
  });
  rerender({ ...defaultPreferences, search: " old " });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(200);
  });
  rerender({ ...defaultPreferences, search: " final " });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(249);
  });
  expect(receiptsApi.list).toHaveBeenCalledTimes(1);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(receiptsApi.list).toHaveBeenCalledTimes(2);
  expect(vi.mocked(receiptsApi.list).mock.calls[1][0].get("search")).toBe(
    "final",
  );
});
it("loads the next page and resets pagination when filters change", async () => {
  vi.mocked(receiptsApi.list).mockResolvedValue({
    items: [receipt],
    total: 100,
    page: 1,
    limit: 50,
  });
  const { result, rerender } = renderHook((p) => useReceiptList(p), {
    initialProps: defaultPreferences,
  });
  await waitFor(() => expect(result.current.query.hasMore).toBe(true));
  act(() => result.current.query.loadMore());
  await waitFor(() => expect(result.current.query.loading).toBe(false));
  expect(vi.mocked(receiptsApi.list).mock.calls[1][0].get("page")).toBe("2");
  rerender({ ...defaultPreferences, source: "MANUAL" });
  await waitFor(() => expect(receiptsApi.list).toHaveBeenCalledTimes(3));
  expect(vi.mocked(receiptsApi.list).mock.calls[2][0].get("page")).toBe("1");
});
