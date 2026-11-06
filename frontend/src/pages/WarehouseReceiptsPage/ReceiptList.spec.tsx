import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { render } from "./receipts-test-render";
import { ReceiptList } from "./ReceiptList";
import { defaultPreferences } from "./receipt-list-preferences";
import { receiptsApi } from "../../shared/api/warehouse-receipts-api";
import { warehousesApi } from "../../shared/api/warehouses-api";
import { receipt, permissions } from "./receipts-test-context";
vi.mock("../../shared/api/warehouse-receipts-api", () => ({
  receiptsApi: { list: vi.fn() },
}));
vi.mock("../../shared/api/warehouses-api", () => ({
  warehousesApi: { list: vi.fn() },
}));
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(receiptsApi.list).mockResolvedValue({
    items: [receipt],
    total: 1,
    page: 1,
    limit: 50,
  });
  vi.mocked(warehousesApi.list).mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    limit: 100,
  });
});
function TestReceiptList({
  userPermissions,
}: {
  userPermissions: readonly string[];
}) {
  const [preferences, setPreferences] = useState(defaultPreferences);
  return (
    <ReceiptList
      permissions={userPermissions}
      preferences={preferences}
      onChange={setPreferences}
    />
  );
}
it("shows progress and uses the working list by default", async () => {
  render(<TestReceiptList userPermissions={permissions} />);
  expect(await screen.findByText("ПН-123")).toBeInTheDocument();
  expect(screen.getByText("4 из 10")).toBeInTheDocument();
  const params = vi.mocked(receiptsApi.list).mock.calls[0][0];
  expect(params.get("status")).toBe("RECEIVED,PLACING");
  expect(params.get("hasConflict")).toBe("false");
  expect(params.get("limit")).toBe("50");
  expect(params.get("sortBy")).toBe("receivedAt");
  expect(params.get("sortOrder")).toBe("desc");
  fireEvent.click(screen.getByRole("button", { name: "Фильтры приходов" }));
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
});

it("sorts the complete server list through standard column headers", async () => {
  render(<TestReceiptList userPermissions={permissions} />);
  await screen.findByText("ПН-123");
  fireEvent.click(screen.getByRole("button", { name: "Сортировать: Получен" }));
  await waitFor(() =>
    expect(
      vi.mocked(receiptsApi.list).mock.calls.at(-1)![0].get("sortOrder"),
    ).toBe("asc"),
  );
  expect(vi.mocked(receiptsApi.list).mock.calls.at(-1)![0].get("page")).toBe(
    "1",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Сортировать: Документ" }),
  );
  await waitFor(() =>
    expect(
      vi.mocked(receiptsApi.list).mock.calls.at(-1)![0].get("sortBy"),
    ).toBe("documentNumber"),
  );
  expect(
    vi.mocked(receiptsApi.list).mock.calls.at(-1)![0].get("sortOrder"),
  ).toBe("asc");
});

it("read-only receipt users cannot create documents", async () => {
  render(<TestReceiptList userPermissions={["warehouse.receipts.read"]} />);
  await screen.findByText("ПН-123");
  expect(
    screen.queryByRole("button", { name: "Ручной приход" }),
  ).not.toBeInTheDocument();
});

it("retries a failed list request", async () => {
  vi.mocked(receiptsApi.list).mockRejectedValueOnce(new Error("Нет связи"));
  render(<TestReceiptList userPermissions={permissions} />);
  fireEvent.click(await screen.findByRole("button", { name: "Повторить" }));
  await screen.findByText("ПН-123");
  await waitFor(() => expect(receiptsApi.list).toHaveBeenCalledTimes(2));
});

it("opens receipts from any cell or the keyboard without a document button", async () => {
  render(<TestReceiptList userPermissions={permissions} />);
  const document = await screen.findByText("ПН-123");
  expect(document.closest("button")).toBeNull();
  const row = document.closest("tr")!;
  expect(row).toHaveAttribute("tabindex", "0");
  fireEvent.click(screen.getByText("Основной"));
  expect(window.location.hash).toBe(`#/warehouse/receipts/${receipt.id}`);
  window.history.replaceState(null, "", "#/warehouse/receipts");
  fireEvent.keyDown(row, { key: "Enter" });
  expect(window.location.hash).toBe(`#/warehouse/receipts/${receipt.id}`);
  window.history.replaceState(null, "", "#/warehouse/receipts");
});

it("retries warehouse loading without reloading the successful receipt list", async () => {
  vi.mocked(warehousesApi.list).mockRejectedValueOnce(
    new Error("Warehouses unavailable"),
  );
  render(
    <TestReceiptList
      userPermissions={[...permissions, "warehouse.storage-locations.read"]}
    />,
  );
  await screen.findByText("Warehouses unavailable");
  await screen.findByText("ПН-123");
  fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
  await waitFor(() => expect(warehousesApi.list).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(
      screen.queryByText("Warehouses unavailable"),
    ).not.toBeInTheDocument(),
  );
  expect(receiptsApi.list).toHaveBeenCalledTimes(1);
});
