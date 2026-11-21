import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { IntegrationWarehousesDialog } from "./IntegrationWarehousesDialog";
import { receiptIntegrationWarehousesApi as api } from "../../shared/api/receipt-integration-warehouses-api";
vi.mock("../../shared/api/receipt-integration-warehouses-api", () => ({
  receiptIntegrationWarehousesApi: { list: vi.fn(), save: vi.fn() },
}));
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.list).mockResolvedValue({
    observed: [],
    links: [],
    warehouses: [{ id: "10", name: "Основной склад" }],
  });
});
function mount() {
  render(
    <ChakraProvider value={defaultSystem}>
      <IntegrationWarehousesDialog code="source-code" onClose={vi.fn()} />
    </ChakraProvider>,
  );
}
it("retries a failed load and clears the previous error", async () => {
  vi.mocked(api.list).mockRejectedValueOnce(new Error("Сбой загрузки"));
  mount();
  await screen.findByText("Сбой загрузки");
  fireEvent.click(screen.getByRole("button", { name: "Повторить загрузку" }));
  await waitFor(() =>
    expect(screen.queryByText("Сбой загрузки")).not.toBeInTheDocument(),
  );
  expect(api.list).toHaveBeenCalledTimes(2);
});

it("maps an observed warehouse using its 1С identifier", async () => {
  vi.mocked(api.list).mockResolvedValueOnce({
    observed: [{ externalId: "warehouse-id", name: "Склад из 1С" }],
    links: [],
    warehouses: [{ id: "10", name: "Основной склад" }],
  });
  vi.mocked(api.save).mockResolvedValue({});
  mount();
  expect(
    screen.queryByRole("button", { name: "Сохранить" }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    await screen.findByRole("button", { name: "Склад ESoft для Склад из 1С" }),
  );
  fireEvent.click(screen.getByRole("option", { name: "Основной склад" }));
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await waitFor(() =>
    expect(api.save).toHaveBeenCalledWith("source-code", {
      externalId: "warehouse-id",
      warehouseId: "10",
    }),
  );
});
it("merges the observed warehouse with its canonical saved link", async () => {
  const externalId = "c9570676-ec8e-11f0-9d39-e0071bf68d7b";
  vi.mocked(api.list).mockResolvedValueOnce({
    observed: [{ externalId, name: "Склад из 1С" }],
    links: [
      {
        externalId,
        warehouseId: "10",
        warehouseName: "Основной склад",
        isActive: true,
      },
    ],
    warehouses: [{ id: "10", name: "Основной склад" }],
  });
  mount();
  const row = await screen.findByRole("row", { name: /Склад из 1С/ });
  expect(row).toHaveClass("integration-warehouse-linked");
  expect(row).toHaveTextContent("Основной склад");
  expect(screen.getAllByRole("row")).toHaveLength(2);
});
