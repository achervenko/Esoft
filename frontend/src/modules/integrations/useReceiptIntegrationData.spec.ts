import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  receiptIntegrationApi,
  type ReceiptSourceKey,
} from "../../shared/api/receipt-integration-api";
import { useReceiptIntegrationData } from "./useReceiptIntegrationData";
import { useReceiptIntegrationKeys } from "./useReceiptIntegrationKeys";

vi.mock("../../shared/api/receipt-integration-api", () => ({
  receiptIntegrationApi: {
    sources: vi.fn(),
    flows: vi.fn(),
    events: vi.fn(),
    keys: vi.fn(),
  },
}));
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(receiptIntegrationApi.sources).mockResolvedValue([]);
  vi.mocked(receiptIntegrationApi.flows).mockResolvedValue([]);
  vi.mocked(receiptIntegrationApi.events).mockResolvedValue({
    items: [],
    total: 0,
  });
});
it("reloads the journal with current filters and aborts obsolete requests", async () => {
  const { result, rerender, unmount } = renderHook(
    ({ page, status, revision }) =>
      useReceiptIntegrationData(revision, page, status),
    { initialProps: { page: 1, status: "PENDING", revision: 0 } },
  );
  await waitFor(() => expect(result.current.loading).toBe(false));
  const firstSignal = vi.mocked(receiptIntegrationApi.sources).mock.calls[0][0];
  rerender({ page: 2, status: "FAILED", revision: 1 });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(firstSignal?.aborted).toBe(true);
  expect(receiptIntegrationApi.events).toHaveBeenLastCalledWith(
    2,
    expect.any(AbortSignal),
    "FAILED",
  );
  const lastSignal = vi.mocked(receiptIntegrationApi.sources).mock.calls[1][0];
  unmount();
  expect(lastSignal?.aborted).toBe(true);
});
it("ignores stale keys after a source change and clears keys on deselection", async () => {
  let resolveOld!: (keys: ReceiptSourceKey[]) => void;
  const stale = new Promise<ReceiptSourceKey[]>((resolve) => {
    resolveOld = resolve;
  });
  const row = {
    id: "new-key",
    name: "New",
    enabled: true,
    expiresAt: null,
    createdAt: "2026-01-01",
  };
  vi.mocked(receiptIntegrationApi.keys)
    .mockReturnValueOnce(stale)
    .mockResolvedValue([row]);
  const onError = vi.fn();
  const { result, rerender } = renderHook(
    ({ selected, revision }) =>
      useReceiptIntegrationKeys(selected, revision, onError),
    { initialProps: { selected: "old", revision: 0 } },
  );
  const oldSignal = vi.mocked(receiptIntegrationApi.keys).mock.calls[0][1];
  rerender({ selected: "new", revision: 0 });
  await waitFor(() => expect(result.current).toEqual([row]));
  await act(async () => {
    resolveOld([{ ...row, id: "stale-key" }]);
    await stale;
  });
  expect(oldSignal?.aborted).toBe(true);
  expect(result.current).toEqual([row]);
  rerender({ selected: "new", revision: 1 });
  await waitFor(() =>
    expect(receiptIntegrationApi.keys).toHaveBeenCalledTimes(3),
  );
  rerender({ selected: "", revision: 1 });
  expect(result.current).toEqual([]);
  expect(onError.mock.calls.every(([error]) => error === null)).toBe(true);
});
it("reports load errors and allows a successful refresh", async () => {
  vi.mocked(receiptIntegrationApi.events).mockRejectedValueOnce(
    new Error("Load failed"),
  );
  const { result, rerender } = renderHook(
    (revision) => useReceiptIntegrationData(revision, 1, "PENDING"),
    { initialProps: 0 },
  );
  await waitFor(() => expect(result.current.error).toBeTruthy());
  rerender(1);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBeNull();
});

it("clears a previous key error when loading another source", async () => {
  vi.mocked(receiptIntegrationApi.keys)
    .mockRejectedValueOnce(new Error("Source A failed"))
    .mockResolvedValue([]);
  const { result, rerender } = renderHook(
    (selected: string) => {
      const [error, setError] = useState<string | null>(null);
      const keys = useReceiptIntegrationKeys(selected, 0, setError);
      return { error, keys };
    },
    { initialProps: "A" },
  );
  await waitFor(() => expect(result.current.error).toBeTruthy());
  rerender("B");
  expect(result.current.error).toBeNull();
  await waitFor(() =>
    expect(receiptIntegrationApi.keys).toHaveBeenLastCalledWith(
      "B",
      expect.any(AbortSignal),
    ),
  );
  expect(result.current.keys).toEqual([]);
  expect(result.current.error).toBeNull();
});
