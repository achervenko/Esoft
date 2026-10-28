import { warehousesApi } from "../../shared/api/warehouses-api";
vi.mock("../../shared/api/warehouses-api", () => ({
  warehousesApi: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
}));
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { ReactElement } from "react";
import { cleanup, render as rawRender } from "@testing-library/react";
import { beforeEach, afterEach, vi } from "vitest";
import { storageLocationsApi } from "../../shared/api/storage-locations-api";
vi.mock("../../shared/api/storage-locations-api", () => ({
  storageLocationsApi: {
    get: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));
export function render(ui: ReactElement) {
  return rawRender(ui, {
    wrapper: ({ children }) => (
      <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
    ),
  });
}
export const item = {
  id: "9007199254740993",
  warehouseId: "1",
  warehouse: { id: "1", name: "Основной склад", isActive: true },

  name: "Полка",
  isActive: true,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(warehousesApi.list).mockResolvedValue({
    items: [item.warehouse],
    total: 1,
    page: 1,
    limit: 100,
  });
  vi.mocked(warehousesApi.create).mockResolvedValue(item.warehouse);
  vi.mocked(warehousesApi.update).mockResolvedValue(item.warehouse);
  vi.mocked(storageLocationsApi.get).mockResolvedValue({
    ...item,
    hasStock: true,
  });
  vi.mocked(storageLocationsApi.list).mockResolvedValue({
    items: [item],
    total: 1,
    page: 1,
    limit: 50,
  });
  vi.mocked(storageLocationsApi.update).mockResolvedValue(item);
  vi.mocked(storageLocationsApi.create).mockResolvedValue(item);
});
afterEach(cleanup);
