import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { render as rawRender, cleanup } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, afterEach, vi } from "vitest";
import {
  warehouseStockApi,
  type StockPosition,
  type StockDistribution,
} from "../../shared/api/warehouse-stock-api";
import { useMediaQuery } from "../../shared/lib/useMediaQuery";
vi.mock("../../shared/api/warehouse-stock-api", () => ({
  warehouseStockApi: {
    warehouses: vi.fn(),
    storageLocations: vi.fn(),
    list: vi.fn(),
    distribution: vi.fn(),
    transfer: vi.fn(),
  },
}));
vi.mock("../../shared/lib/useMediaQuery", () => ({ useMediaQuery: vi.fn() }));
export const warehouse = {
  id: "9007199254740993",
  name: "Основной склад",
  isActive: true,
};
export const location = {
  id: "9007199254740995",
  name: "Угол ангара",
  warehouseId: warehouse.id,
  warehouse,
  isActive: true,
};
export const secondLocation = {
  ...location,
  id: "9007199254740996",
  name: "Ящик",
};
export const position: StockPosition = {
  id: `1:${warehouse.id}`,
  item: {
    id: "9007199254740997",
    article: "6204",
    name: "Подшипник",
    unit: "шт",
    isActive: true,
    photo: null,
  },
  warehouse,
  quantity: "17.001",
  locationsCount: 2,
  locationsPreview: [
    { location, quantity: "10.001" },
    { location: secondLocation, quantity: "7" },
  ],
};
export const distribution: StockDistribution = {
  item: position.item,
  warehouse,
  totalQuantity: position.quantity,
  locations: [
    {
      balanceId: "10",
      location,
      quantity: "10.001",
      reserved: "2",
      available: "8.001",
    },
    {
      balanceId: "11",
      location: secondLocation,
      quantity: "7",
      reserved: "0",
      available: "7",
    },
  ],
};
export function render(ui: ReactElement) {
  return rawRender(ui, {
    wrapper: ({ children }) => (
      <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
    ),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useMediaQuery).mockReturnValue(false);
  vi.mocked(warehouseStockApi.list).mockResolvedValue({
    items: [position],
    total: 1,
    page: 1,
    limit: 50,
  });
  vi.mocked(warehouseStockApi.distribution).mockResolvedValue(distribution);
  vi.mocked(warehouseStockApi.transfer).mockResolvedValue({ id: "1" });
  vi.mocked(warehouseStockApi.warehouses).mockResolvedValue({
    items: [warehouse],
    total: 1,
    page: 1,
    limit: 100,
  });
  vi.mocked(warehouseStockApi.storageLocations).mockResolvedValue({
    items: [location, secondLocation],
    total: 2,
    page: 1,
    limit: 100,
  });
});
afterEach(cleanup);
