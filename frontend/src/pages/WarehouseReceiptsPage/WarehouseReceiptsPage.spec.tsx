import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { render } from "./receipts-test-render";
import { WarehouseReceiptsPage } from "./WarehouseReceiptsPage";
import { receiptsApi } from "../../shared/api/warehouse-receipts-api";
import { warehousesApi } from "../../shared/api/warehouses-api";
import { receipt, permissions } from "./receipts-test-context";
vi.mock("../../shared/api/warehouse-receipts-api", () => ({
  receiptsApi: {
    list: vi.fn(),
    get: vi.fn(),
    reconciliationCandidates: vi.fn(),
  },
}));
vi.mock("../../shared/api/warehouses-api", () => ({
  warehousesApi: { list: vi.fn() },
}));
afterEach(cleanup);
beforeEach(() => {
  sessionStorage.clear();
  vi.resetAllMocks();
  vi.mocked(receiptsApi.reconciliationCandidates).mockResolvedValue({
    items: [],
  });
  vi.mocked(receiptsApi.list).mockResolvedValue({
    items: [receipt],
    total: 1,
    page: 1,
    limit: 50,
  });
  vi.mocked(receiptsApi.get).mockResolvedValue(receipt);
  vi.mocked(warehousesApi.list).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    limit: 100,
  });
});
it("does not query the API without receipt permission", () => {
  render(<WarehouseReceiptsPage userPermissions={[]} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Недостаточно прав");
  expect(receiptsApi.list).not.toHaveBeenCalled();
  expect(warehousesApi.list).not.toHaveBeenCalled();
});
it("keeps exactly one list after opening and closing manual receipt creation", async () => {
  const props = { userPermissions: permissions, actorId: "keeper" };
  const view = render(<WarehouseReceiptsPage {...props} />);
  await screen.findByText("ПН-123");
  for (let attempt = 0; attempt < 2; attempt++) {
    view.rerender(<WarehouseReceiptsPage {...props} creating />);
    expect(
      await screen.findByRole("dialog", { name: "Ручной приход" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Приходы" })).toHaveLength(1);
    view.rerender(<WarehouseReceiptsPage {...props} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Приходы" })).toHaveLength(1);
    expect(screen.getAllByText("ПН-123")).toHaveLength(1);
  }
});
it("keeps filters, search and sorting when returning from a receipt", async () => {
  const props = { userPermissions: permissions, actorId: "keeper" };
  const view = render(<WarehouseReceiptsPage {...props} />);
  await screen.findByText("ПН-123");
  fireEvent.click(
    screen.getByRole("button", { name: "Сортировать: Документ" }),
  );
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "ПН" } });
  fireEvent.click(screen.getByRole("button", { name: "Фильтры приходов" }));
  fireEvent.change(screen.getByLabelText("Дата документа с"), {
    target: { value: "2026-10-01" },
  });
  fireEvent.change(screen.getByLabelText("Дата документа по"), {
    target: { value: "2026-10-31" },
  });
  fireEvent.click(await screen.findByRole("button", { name: "Состояния" }));
  fireEvent.click(await screen.findByRole("option", { name: "Размещён" }));
  view.rerender(<WarehouseReceiptsPage {...props} receiptId={receipt.id} />);
  await screen.findByRole("button", { name: "← Назад" });
  vi.mocked(receiptsApi.list).mockClear();
  view.rerender(<WarehouseReceiptsPage {...props} />);
  await screen.findByText("ПН-123");
  const params = vi.mocked(receiptsApi.list).mock.calls[0][0];
  expect(params.get("documentDateFrom")).toBe("2026-10-01");
  expect(params.get("documentDateTo")).toBe("2026-10-31");
  expect(params.has("createdFrom")).toBe(false);
  expect(params.get("search")).toBe("ПН");
  expect(params.get("status")).toBe("RECEIVED,PLACING,PLACED");
  expect(params.get("sortBy")).toBe("documentNumber");
  expect(params.get("sortOrder")).toBe("asc");
  expect(screen.getByRole("searchbox")).toHaveValue("ПН");
  view.rerender(<WarehouseReceiptsPage {...props} actorId="other" />);
  await waitFor(() =>
    expect(
      vi.mocked(receiptsApi.list).mock.calls.at(-1)![0].get("search"),
    ).toBeNull(),
  );
});
