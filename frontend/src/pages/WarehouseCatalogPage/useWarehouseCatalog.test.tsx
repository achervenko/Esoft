import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useWarehouseCatalog } from "./useWarehouseCatalog";
import {
  warehouseCatalogApi,
  type WarehouseCatalogList,
} from "../../shared/api/warehouse-catalog-api";
import {
  item,
  wrapper,
  setupWarehouseCatalogTests,
} from "./warehouse-catalog-test-utils";
setupWarehouseCatalogTests();
beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(warehouseCatalogApi.list).mockResolvedValue({
    items: [item],
    total: 101,
    limit: 50,
    offset: 0,
  });
});

it("debounces only typing and requests filters, pages and reload immediately", async () => {
  const hook = renderHook(() => useWarehouseCatalog(true), { wrapper });
  await act(async () => {});
  expect(warehouseCatalogApi.list).toHaveBeenCalledTimes(1);
  await act(async () => hook.result.current.setActive("false"));
  expect(warehouseCatalogApi.list).toHaveBeenCalledTimes(2);
  expect(
    vi.mocked(warehouseCatalogApi.list).mock.lastCall?.[0].get("isActive"),
  ).toBe("false");
  await act(async () => hook.result.current.list.loadMore());
  expect(warehouseCatalogApi.list).toHaveBeenCalledTimes(3);
  expect(
    vi.mocked(warehouseCatalogApi.list).mock.lastCall?.[0].get("offset"),
  ).toBe("50");
  act(() => hook.result.current.setSearch("бол"));
  act(() => hook.result.current.setSearch("болт"));
  await act(async () => vi.advanceTimersByTime(249));
  expect(warehouseCatalogApi.list).toHaveBeenCalledTimes(3);
  await act(async () => vi.advanceTimersByTime(1));
  expect(warehouseCatalogApi.list).toHaveBeenCalledTimes(4);
  expect(vi.mocked(warehouseCatalogApi.list).mock.lastCall?.[0].get("q")).toBe(
    "болт",
  );
  expect(
    vi.mocked(warehouseCatalogApi.list).mock.lastCall?.[0].get("offset"),
  ).toBe("0");
  await act(async () => hook.result.current.reload());
  expect(warehouseCatalogApi.list).toHaveBeenCalledTimes(5);
});
it("uses the current typed search immediately when applying a filter", async () => {
  const hook = renderHook(() => useWarehouseCatalog(true), { wrapper });
  await act(async () => {});
  act(() => hook.result.current.setSearch("кабель"));
  await act(async () => hook.result.current.setActive("true"));
  expect(warehouseCatalogApi.list).toHaveBeenCalledTimes(2);
  const query = vi.mocked(warehouseCatalogApi.list).mock.lastCall![0];
  expect(query.get("q")).toBe("кабель");
  expect(query.get("isActive")).toBe("true");
  await act(async () => vi.advanceTimersByTime(250));
  expect(warehouseCatalogApi.list).toHaveBeenCalledTimes(2);
});
it("synchronizes hash navigation without remount and resets the page", async () => {
  const hook = renderHook(() => useWarehouseCatalog(true), { wrapper });
  await act(async () => {});
  await act(async () => hook.result.current.list.loadMore());
  await act(async () => {
    window.history.replaceState(
      null,
      "",
      "#/warehouse/catalog?q=насос&isActive=false",
    );
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  expect(hook.result.current.query).toEqual({
    search: "насос",
    active: "false",
  });
  expect(warehouseCatalogApi.list).toHaveBeenCalledTimes(3);
  const query = vi.mocked(warehouseCatalogApi.list).mock.lastCall![0];
  expect(query.get("q")).toBe("насос");
  expect(query.get("isActive")).toBe("false");
  await act(async () => {
    window.history.replaceState(null, "", "#/warehouse/catalog");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  expect(hook.result.current.query).toEqual({
    search: "",
    active: "",
  });
  expect(warehouseCatalogApi.list).toHaveBeenCalledTimes(4);
  hook.unmount();
  window.dispatchEvent(new HashChangeEvent("hashchange"));
  expect(warehouseCatalogApi.list).toHaveBeenCalledTimes(4);
});

it("refreshes the accumulated list from offset zero", async () => {
  const hook = renderHook(() => useWarehouseCatalog(true), { wrapper });
  await act(async () => {});
  await act(async () => hook.result.current.list.loadMore());
  await act(async () => hook.result.current.reload());
  expect(
    vi
      .mocked(warehouseCatalogApi.list)
      .mock.calls.map(([q]) => q.get("offset")),
  ).toEqual(["0", "50", "0"]);
  expect(hook.result.current.data?.items).toEqual([item]);
});

it("separates next-page loading and errors from initial state and retries the same offset", async () => {
  const hook = renderHook(() => useWarehouseCatalog(true), { wrapper });
  expect(hook.result.current.loading).toBe(true);
  await act(async () => {});
  let fail!: (error: Error) => void;
  vi.mocked(warehouseCatalogApi.list).mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        fail = reject;
      }),
  );
  act(() => hook.result.current.list.loadMore());
  expect(hook.result.current.loading).toBe(false);
  expect(hook.result.current.list.loading).toBe(true);
  expect(hook.result.current.data?.items).toEqual([item]);
  await act(async () => fail(new Error("Ошибка следующей порции")));
  expect(hook.result.current.loadError).toBeNull();
  expect(hook.result.current.list.error).toBe("Ошибка следующей порции");
  expect(hook.result.current.loading).toBe(false);
  expect(hook.result.current.data?.items).toEqual([item]);
  await act(async () => hook.result.current.list.retry());
  expect(hook.result.current.list.error).toBeNull();
  expect(
    vi
      .mocked(warehouseCatalogApi.list)
      .mock.calls.map(([query]) => query.get("offset")),
  ).toEqual(["0", "50", "50"]);
});

it("exposes an initial failure as loadError without data", async () => {
  vi.mocked(warehouseCatalogApi.list).mockRejectedValueOnce(
    new Error("Список недоступен"),
  );
  const hook = renderHook(() => useWarehouseCatalog(true), { wrapper });
  await act(async () => {});
  expect(hook.result.current.loading).toBe(false);
  expect(hook.result.current.data).toBeNull();
  expect(hook.result.current.loadError).toBe("Список недоступен");
});

it("aborts old searches and ignores late responses", async () => {
  vi.useFakeTimers();
  const pending: {
    signal?: AbortSignal;
    resolve: (data: WarehouseCatalogList) => void;
  }[] = [];
  vi.mocked(warehouseCatalogApi.list).mockImplementation(
    (_q, signal) => new Promise((resolve) => pending.push({ signal, resolve })),
  );
  const hook = renderHook(() => useWarehouseCatalog(true), { wrapper });
  await act(async () => vi.advanceTimersByTime(250));
  act(() => hook.result.current.setSearch("новый"));
  expect(pending[0].signal?.aborted).toBe(true);
  await act(async () => vi.advanceTimersByTime(250));
  await act(async () =>
    pending[1].resolve({ items: [item], total: 1, limit: 50, offset: 0 }),
  );
  await act(async () =>
    pending[0].resolve({ items: [], total: 0, limit: 50, offset: 0 }),
  );
  expect(hook.result.current.data?.items).toEqual([item]);
  act(() => hook.result.current.reload());
  hook.unmount();
  expect(pending[2].signal?.aborted).toBe(true);
});
