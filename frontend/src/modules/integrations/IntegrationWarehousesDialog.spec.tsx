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
it("saves an administrative link for the selected source and reloads its list", async () => {
  vi.mocked(api.save).mockResolvedValue({});
  mount();
  await waitFor(() =>
    expect(screen.queryByText("Загрузка…")).not.toBeInTheDocument(),
  );
  fireEvent.change(screen.getByLabelText("Идентификатор склада 1С"), {
    target: { value: " external-guid " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Склад ESoft" }));
  fireEvent.click(screen.getByRole("option", { name: "Основной склад" }));
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await waitFor(() =>
    expect(api.save).toHaveBeenCalledExactlyOnceWith("source-code", {
      externalId: "external-guid",
      warehouseId: "10",
    }),
  );
  await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
});
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
