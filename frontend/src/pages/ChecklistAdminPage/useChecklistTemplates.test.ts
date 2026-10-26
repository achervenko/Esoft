import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import * as api from "../../shared/api/checklists";
import { useChecklistTemplates } from "./useChecklistTemplates";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const item = (id: number) => ({ id }) as api.ChecklistTemplateListItem;

it("updates the visible state when applying a status filter", async () => {
  const request = vi
    .spyOn(api, "getChecklistTemplates")
    .mockResolvedValue({ items: [], total: 0, limit: 100, page: 1 });
  const hook = renderHook(() => useChecklistTemplates({ enabled: true }));
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  act(() => hook.result.current.applyFilters({ state: "ARCHIVED" }));
  expect(hook.result.current.state).toBe("ARCHIVED");
  await waitFor(() =>
    expect(request).toHaveBeenLastCalledWith(
      {
        limit: 100,
        page: 1,
        search: "",
        state: "ARCHIVED",
        sortBy: "name",
        sortDirection: "asc",
      },
      expect.any(AbortSignal),
    ),
  );
});

it("loads selected template pages and resets pagination when applying filters", async () => {
  const request = vi
    .spyOn(api, "getChecklistTemplates")
    .mockImplementation(async (query = {}) => ({
      items:
        query.page === 1
          ? Array.from({ length: 100 }, (_, id) => item(id))
          : [item(100)],
      total: 101,
      limit: 100,
      page: Number(query.page),
    }));
  const hook = renderHook(() => useChecklistTemplates({ enabled: true }));
  await waitFor(() => expect(hook.result.current.templates).toHaveLength(100));
  expect(request).toHaveBeenCalledOnce();
  act(() => hook.result.current.list.loadMore());
  await waitFor(() => expect(hook.result.current.templates).toHaveLength(101));
  act(() => {
    hook.result.current.setSearch(" насос ");
    hook.result.current.setState("ARCHIVED");
  });
  act(() => hook.result.current.applyFilters());
  await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
  expect(request).toHaveBeenLastCalledWith(
    {
      limit: 100,
      page: 1,
      search: "насос",
      state: "ARCHIVED",
      sortBy: "name",
      sortDirection: "asc",
    },
    expect.any(AbortSignal),
  );
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
});

it("sends sorting to the server for every batch and resets accumulated rows when it changes", async () => {
  const request = vi
    .spyOn(api, "getChecklistTemplates")
    .mockImplementation(async (query = {}) => ({
      items: query.page === 1 ? [item(1)] : [item(2)],
      total: 201,
      limit: 100,
      page: Number(query.page),
    }));
  const hook = renderHook(() => useChecklistTemplates({ enabled: true }));
  await waitFor(() => expect(hook.result.current.templates).toHaveLength(1));
  act(() => hook.result.current.list.loadMore());
  await waitFor(() => expect(hook.result.current.templates).toHaveLength(2));
  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({ page: 2, sortBy: "name", sortDirection: "asc" }),
    expect.any(AbortSignal),
  );
  act(() =>
    hook.result.current.setSort({ key: "questions", direction: "desc" }),
  );
  await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      page: 1,
      sortBy: "questionCount",
      sortDirection: "desc",
    }),
    expect.any(AbortSignal),
  );
  await waitFor(() => expect(hook.result.current.templates).toEqual([item(1)]));
  act(() => hook.result.current.list.loadMore());
  await waitFor(() => expect(request).toHaveBeenCalledTimes(4));
  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({
      page: 2,
      sortBy: "questionCount",
      sortDirection: "desc",
    }),
    expect.any(AbortSignal),
  );
  act(() => hook.result.current.setSort({ key: "state", direction: "asc" }));
  await waitFor(() => expect(request).toHaveBeenCalledTimes(5));
  expect(request).toHaveBeenLastCalledWith(
    expect.objectContaining({ page: 1, sortBy: "state", sortDirection: "asc" }),
    expect.any(AbortSignal),
  );
});

it("ignores a pending template page after disabling the list", async () => {
  let resolve!: (
    value: api.ChecklistPageResponse<api.ChecklistTemplateListItem>,
  ) => void;
  const request = vi.spyOn(api, "getChecklistTemplates").mockReturnValue(
    new Promise((yes) => {
      resolve = yes;
    }),
  );
  const hook = renderHook(({ enabled }) => useChecklistTemplates({ enabled }), {
    initialProps: { enabled: true },
  });
  hook.rerender({ enabled: false });
  await act(async () => {
    resolve({ items: [item(1)], total: 201, page: 1, limit: 200 });
  });
  expect(hook.result.current.templates).toEqual([]);
  expect(hook.result.current.isLoading).toBe(false);
  expect(request).toHaveBeenCalledOnce();
});
