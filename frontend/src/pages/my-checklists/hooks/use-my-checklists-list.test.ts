import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import * as api from "../../../shared/api/checklists";
import type { ChecklistTabKey } from "../my-checklists.config";
import { useMyChecklistsList } from "./use-my-checklists-list";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const item = (id: number) => ({ id }) as api.ChecklistWorkListItem;
const response = (items: api.ChecklistWorkListItem[], total = items.length) =>
  ({ items, total, totalsByStatus: { IN_PROGRESS: total } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

it("loads only the selected page and replaces rows on navigation", async () => {
  const first = Array.from({ length: 100 }, (_, id) => item(id));
  const request = vi.spyOn(api, "getChecklistWorkItems")
    .mockResolvedValueOnce(response(first, 101))
    .mockResolvedValueOnce(response([item(100)], 101));
  const hook = renderHook(() => useMyChecklistsList({ activeTab: "in-progress" }));
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  expect(hook.result.current.items).toHaveLength(100);
  expect(request).toHaveBeenCalledOnce();
  act(() => hook.result.current.setPage(1));
  await waitFor(() => expect(hook.result.current.items).toEqual([item(100)]));
  expect(hook.result.current.total).toBe(101);
  expect(request).toHaveBeenNthCalledWith(2, { limit: 100, offset: 100, status: ["IN_PROGRESS"] });
});

it("ignores an old rejection after the new tab has loaded", async () => {
  const old = deferred<api.ChecklistWorkListResponse>();
  vi.spyOn(api, "getChecklistWorkItems").mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce(response([item(2)]));
  const hook = renderHook(({ activeTab }: { activeTab: ChecklistTabKey }) =>
    useMyChecklistsList({ activeTab }), { initialProps: { activeTab: "new" } });
  hook.rerender({ activeTab: "in-progress" });
  await waitFor(() => expect(hook.result.current.items).toEqual([item(2)]));
  await act(async () => { old.reject(new Error("old failure")); });
  expect(hook.result.current.items).toEqual([item(2)]);
  expect(hook.result.current.error).toBeNull();
  expect(hook.result.current.total).toBe(1);
});

it("keeps the new tab loading when an old request finishes", async () => {
  const old = deferred<api.ChecklistWorkListResponse>();
  const current = deferred<api.ChecklistWorkListResponse>();
  const request = vi.spyOn(api, "getChecklistWorkItems")
    .mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  const hook = renderHook(({ activeTab }: { activeTab: ChecklistTabKey }) =>
    useMyChecklistsList({ activeTab }), { initialProps: { activeTab: "new" } });
  hook.rerender({ activeTab: "completed" });
  await act(async () => { old.resolve(response([item(1)], 101)); });
  expect(hook.result.current.isLoading).toBe(true);
  expect(request).toHaveBeenCalledTimes(2);
  await act(async () => { current.resolve(response([item(3)])); });
  expect(hook.result.current.items).toEqual([item(3)]);
});

it("reports an incomplete page instead of looping forever", async () => {
  const request = vi.spyOn(api, "getChecklistWorkItems").mockResolvedValue(response([], 1));
  const hook = renderHook(() => useMyChecklistsList({ activeTab: "new" }));
  await waitFor(() => expect(hook.result.current.error).toBeTruthy());
  expect(hook.result.current.isLoading).toBe(false);
  expect(request).toHaveBeenCalledOnce();
});

it("clears all counters while the next tab is loading", async () => {
  const pending = deferred<api.ChecklistWorkListResponse>();
  vi.spyOn(api, "getChecklistWorkItems")
    .mockResolvedValueOnce(response([item(1)]))
    .mockReturnValueOnce(pending.promise);
  const hook = renderHook(({ activeTab }: { activeTab: ChecklistTabKey }) =>
    useMyChecklistsList({ activeTab }), { initialProps: { activeTab: "in-progress" } });
  await waitFor(() => expect(hook.result.current.totalsByStatus).toEqual({ IN_PROGRESS: 1 }));
  hook.rerender({ activeTab: "completed" });
  expect(hook.result.current.isLoading).toBe(true);
  expect(hook.result.current.items).toEqual([]);
  expect(hook.result.current.total).toBe(0);
  expect(hook.result.current.totalsByStatus).toEqual({});
  await act(async () => { pending.resolve(response([item(2)])); });
});
