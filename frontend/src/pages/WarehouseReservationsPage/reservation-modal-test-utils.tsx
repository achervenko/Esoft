import { fireEvent, render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { vi } from "vitest";
import { WarehouseReservationsPage } from "./WarehouseReservationsPage";
import {
  warehouseReservationsApi,
  type Reservation,
} from "../../shared/api/warehouse-reservations-api";
export const id = "873e93da-fa3b-4d4e-b90f-fff6eb6731c3";
export const order = {
  id,
  number: "202",
  name: "Монтаж",
  status: "Закрыт",
  closed: true,
  warnings: [{ code: "ORDER_CLOSED", message: "Заказ закрыт." }],
};
const location = {
  id: "1",
  name: "А-02",
  isActive: true,
  warehouseId: "1",
  warehouse: { id: "1", name: "Склад 1", isActive: true },
};
export const row: Reservation = {
  id: "r1",
  order,
  item: {
    id: "1",
    article: "6205",
    name: "Подшипник",
    unit: "шт",
    isActive: true,
  },
  quantity: "10.125",
  coveredQuantity: "8",
  deficitQuantity: "2.125",
  warnings: order.warnings,
  allocations: [
    { id: "a1", location, quantity: "8" },
    {
      id: "a0",
      location: { ...location, id: "2", name: "Нулевое место" },
      quantity: "0",
    },
  ],
};
export const mount = async (permissions = ["warehouse.reservations.read"]) => {
  render(
    <ChakraProvider value={defaultSystem}>
      <WarehouseReservationsPage userPermissions={permissions} />
    </ChakraProvider>,
  );
  if (permissions.length)
    fireEvent.click(
      await screen.findByRole("button", { name: /Позиции заказа 202:/ }),
    );
};
export function setupReservationModal() {
  vi.clearAllMocks();
  vi.mocked(warehouseReservationsApi.orders).mockResolvedValue({
    items: [{ order, positionsCount: 1, deficitPositionsCount: 1 }],
    total: 1,
    page: 1,
    limit: 50,
  });
  vi.mocked(warehouseReservationsApi.summary).mockResolvedValue({
    order,
    positionsCount: 1,
    deficitPositionsCount: 1,
  });
  vi.mocked(warehouseReservationsApi.list).mockResolvedValue({
    items: [row],
    total: 1,
    page: 1,
    limit: 50,
  });
}
