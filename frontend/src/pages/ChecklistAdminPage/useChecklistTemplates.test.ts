import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import * as api from "../../shared/api/checklists";
import { useChecklistTemplates } from "./useChecklistTemplates";
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const item = (id: number) => ({ id }) as api.ChecklistTemplateListItem;

it("loads selected template pages and resets pagination when applying filters", async () => {
  const request = vi.spyOn(api, "getChecklistTemplates").mockImplementation(async (query = {}) => ({
    items: query.page === 1 ? Array.from({ length: 100 }, (_, id) => item(id)) : [item(100)],
    total: 101, limit: 100, page: Number(query.page),
  }));
  const hook = renderHook(() => useChecklistTemplates({ enabled: true }));
  await waitFor(() => expect(hook.result.current.templates).toHaveLength(100));
  expect(request).toHaveBeenCalledOnce();
  act(() => hook.result.current.setPage(1));
  await waitFor(() => expect(hook.result.current.templates).toEqual([item(100)]));
  act(() => { hook.result.current.setSearch(" насос "); hook.result.current.setState("ARCHIVED"); });
  act(() => hook.result.current.applyFilters());
  await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
  expect(request).toHaveBeenLastCalledWith({ limit: 100, page: 1, search: "насос", state: "ARCHIVED" });
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
});

it("ignores a pending template page after disabling the list", async () => {
  let resolve!: (value: api.ChecklistPageResponse<api.ChecklistTemplateListItem>) => void;
  const request = vi.spyOn(api, "getChecklistTemplates").mockReturnValue(new Promise((yes) => { resolve = yes; }));
  const hook = renderHook(({ enabled }) => useChecklistTemplates({ enabled }), { initialProps: { enabled: true } });
  hook.rerender({ enabled: false });
  await act(async () => { resolve({ items: [item(1)], total: 201, page: 1, limit: 200 }); });
  expect(hook.result.current.templates).toEqual([]);
  expect(hook.result.current.isLoading).toBe(false);
  expect(request).toHaveBeenCalledOnce();
});
