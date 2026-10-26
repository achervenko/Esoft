import { beforeEach, expect, it, vi } from "vitest";
import { request } from "./api-client";
import { warehouseCatalogApi } from "./warehouse-catalog-api";
vi.mock("./api-client", () => ({ request: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
it("uses the Catalog HTTP contract and preserves string IDs", () => {
  const id = "9007199254740993";
  const input = { article: "A", name: "Item", unit: "шт", comment: null };
  const controller = new AbortController();
  warehouseCatalogApi.list(
    new URLSearchParams({
      q: "%_",
      isActive: "false",
      limit: "50",
      offset: "50",
    }),
    controller.signal,
  );
  expect(request).toHaveBeenLastCalledWith(
    "/api/warehouse/items?q=%25_&isActive=false&limit=50&offset=50",
    { signal: controller.signal },
  );
  warehouseCatalogApi.get(id, controller.signal);
  expect(request).toHaveBeenLastCalledWith(`/api/warehouse/items/${id}`, {
    signal: controller.signal,
  });
  warehouseCatalogApi.create(input);
  expect(request).toHaveBeenLastCalledWith("/api/warehouse/items", {
    method: "POST",
    body: JSON.stringify(input),
  });
  warehouseCatalogApi.update(id, { name: "Updated" });
  expect(request).toHaveBeenLastCalledWith(`/api/warehouse/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name: "Updated" }),
  });
  warehouseCatalogApi.setStatus(id, false);
  expect(request).toHaveBeenLastCalledWith(
    `/api/warehouse/items/${id}/status`,
    { method: "PATCH", body: JSON.stringify({ isActive: false }) },
  );
});
