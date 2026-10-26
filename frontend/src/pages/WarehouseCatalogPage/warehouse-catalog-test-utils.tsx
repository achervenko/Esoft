import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { ReactElement, ReactNode } from "react";
import {
  cleanup,
  fireEvent,
  render as rawRender,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import {
  warehouseCatalogApi,
  type WarehouseItem,
} from "../../shared/api/warehouse-catalog-api";
import { ConfirmationContext } from "../../shared/ui/confirmation-context";
export const item: WarehouseItem = {
  id: "9007199254740993",
  article: "CAT-01",
  name: "Подшипник",
  unit: "шт",
  comment: "Редуктор",
  isActive: true,
};
export const permissions = ["warehouse.catalog.manage"];
export const confirm = vi.fn();
export function wrapper({ children }: { children: ReactNode }) {
  return (
    <ChakraProvider value={defaultSystem}>
      <ConfirmationContext.Provider value={confirm}>
        {children}
      </ConfirmationContext.Provider>
    </ChakraProvider>
  );
}
export function renderWarehouse(ui: ReactElement) {
  return rawRender(ui, { wrapper });
}
export function setupWarehouseCatalogTests() {
  beforeEach(() => {
    vi.resetAllMocks();
    window.history.replaceState(null, "", "#/warehouse/catalog");
    vi.spyOn(warehouseCatalogApi, "list").mockResolvedValue({
      items: [item],
      total: 1,
      limit: 50,
      offset: 0,
    });
    vi.spyOn(warehouseCatalogApi, "create").mockResolvedValue(item);
    vi.spyOn(warehouseCatalogApi, "update").mockResolvedValue(item);
    vi.spyOn(warehouseCatalogApi, "setStatus").mockResolvedValue({
      ...item,
      isActive: false,
    });
    confirm.mockResolvedValue(true);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
    window.history.replaceState(null, "", "#/");
  });
}
export async function openCreate() {
  fireEvent.click(
    screen.getByRole("button", { name: "Добавить номенклатуру" }),
  );
  const dialog = screen.getByRole("dialog");
  for (const [label, value] of [
    ["Артикул", " NEW "],
    ["Наименование", " Новая "],
    ["Ед. изм.", " шт "],
  ])
    fireEvent.change(within(dialog).getByLabelText(label), {
      target: { value },
    });
  return dialog;
}
