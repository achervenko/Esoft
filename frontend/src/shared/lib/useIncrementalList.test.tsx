import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useIncrementalList } from "./useIncrementalList";
type Item = { id: string; name?: string };
type Page = { items: Item[]; total: number; limit: number };
const page = (id: string, total = 3): Page => ({
  items: [{ id }],
  total,
  limit: 1,
});
const keyOf = (item: Item) => item.id;
afterEach(cleanup);

it("accumulates all 4003 items in 81 batches without duplicates or missing offsets", async () => {
  const items = Array.from({ length: 4003 }, (_, i) => ({
    id: String(9007199254740993n + BigInt(i)),
  }));
  const load = vi.fn(async (offset: number) => ({
    items: items.slice(offset, offset + 50),
    total: items.length,
    limit: 50,
  }));
  const hook = renderHook(() =>
    useIncrementalList({
      queryKey: "4003",
      enabled: true,
      loadPage: load,
      getKey: keyOf,
    }),
  );
  await act(async () => {});
  for (let batch = 1; batch <= 80; batch++) {
    expect(hook.result.current.hasMore).toBe(true);
    await act(async () => hook.result.current.loadMore());
  }
  expect(load.mock.calls.map(([offset]) => offset)).toEqual(
    Array.from({ length: 81 }, (_, i) => i * 50),
  );
  expect(hook.result.current.data?.items).toEqual(items);
  expect(hook.result.current.hasMore).toBe(false);
  await act(async () => hook.result.current.loadMore());
  expect(load).toHaveBeenCalledTimes(81);
});

it("serializes load-more calls and ignores completed callbacks without skipping an offset", async () => {
  let resolve!: (page: Page) => void;
  const load = vi
    .fn()
    .mockResolvedValueOnce(page("9007199254740993"))
    .mockImplementationOnce(
      () =>
        new Promise<Page>((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValueOnce(page("3"));
  const hook = renderHook(() =>
    useIncrementalList({
      queryKey: "all",
      enabled: true,
      loadPage: load,
      getKey: keyOf,
    }),
  );
  await act(async () => {});
  const staleLoadMore = hook.result.current.loadMore;
  act(() => {
    staleLoadMore();
    staleLoadMore();
  });
  expect(load.mock.calls.map(([offset]) => offset)).toEqual([0, 1]);
  await act(async () => resolve(page("2")));
  await act(async () => staleLoadMore());
  expect(load).toHaveBeenCalledTimes(2);
  expect(hook.result.current.data?.items.map((item) => item.id)).toEqual([
    "9007199254740993",
    "2",
  ]);
  await act(async () => hook.result.current.loadMore());
  expect(load.mock.calls.map(([offset]) => offset)).toEqual([0, 1, 2]);
  expect(hook.result.current.hasMore).toBe(false);
});

it("keeps loaded items on failure and retries exactly the failed offset", async () => {
  const load = vi
    .fn()
    .mockResolvedValueOnce(page("1"))
    .mockRejectedValueOnce(new Error("Нет сети"))
    .mockResolvedValueOnce({
      items: [{ id: "1", name: "updated" }, { id: "2" }],
      limit: 1,
      total: 2,
    });
  const hook = renderHook(() =>
    useIncrementalList({
      queryKey: "all",
      enabled: true,
      loadPage: load,
      getKey: keyOf,
    }),
  );
  await act(async () => {});
  await act(async () => hook.result.current.loadMore());
  expect(hook.result.current.data?.items).toEqual([{ id: "1" }]);
  expect(hook.result.current.error).toBe("Нет сети");
  await act(async () => hook.result.current.loadMore());
  expect(load).toHaveBeenCalledTimes(2);
  await act(async () => hook.result.current.retry());
  expect(load.mock.calls.map(([offset]) => offset)).toEqual([0, 1, 1]);
  expect(hook.result.current.data?.items).toEqual([
    { id: "1", name: "updated" },
    { id: "2" },
  ]);
});

it("aborts changed queries and cannot append late data from a previous list", async () => {
  let resolve!: (page: Page) => void;
  const load = vi
    .fn()
    .mockResolvedValueOnce(page("old"))
    .mockImplementationOnce(
      () =>
        new Promise<Page>((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValueOnce(page("new", 1));
  const hook = renderHook(
    ({ key }) =>
      useIncrementalList({
        queryKey: key,
        enabled: true,
        loadPage: load,
        getKey: keyOf,
      }),
    { initialProps: { key: "old" } },
  );
  await act(async () => {});
  const staleLoadMore = hook.result.current.loadMore;
  act(() => staleLoadMore());
  const signal = load.mock.calls[1][1] as AbortSignal;
  hook.rerender({ key: "new" });
  await act(async () => {});
  expect(signal.aborted).toBe(true);
  await act(async () => {
    resolve(page("late"));
    staleLoadMore();
  });
  expect(hook.result.current.data?.items).toEqual([{ id: "new" }]);
  expect(load).toHaveBeenCalledTimes(3);
});

it("stops on an empty batch and does not fetch without access", async () => {
  const load = vi.fn().mockResolvedValue({ items: [], total: 10, limit: 50 });
  const hook = renderHook(
    ({ enabled }) =>
      useIncrementalList({
        queryKey: "all",
        enabled,
        loadPage: load,
        getKey: keyOf,
      }),
    { initialProps: { enabled: false } },
  );
  expect(load).not.toHaveBeenCalled();
  hook.rerender({ enabled: true });
  await act(async () => {});
  expect(hook.result.current.hasMore).toBe(false);
  await act(async () => hook.result.current.loadMore());
  expect(load).toHaveBeenCalledTimes(1);
});
