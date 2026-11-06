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
it("filters multiple states including conflicts using the shared multiselect", async () => {
  render(<TestReceiptList userPermissions={permissions} />);
  await screen.findByText("ПН-123");
  expect(
    screen.queryByRole("button", { name: "Сортировать: Состояние" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Фильтры приходов" }));
  fireEvent.click(await screen.findByRole("button", { name: "Состояния" }));
  await screen.findByRole("option", { name: "Отменён" });
  fireEvent.click(screen.getByRole("option", { name: "Размещён" }));
  fireEvent.click(screen.getByRole("option", { name: "Конфликт с 1С" }));
  await waitFor(() =>
    expect(
      vi.mocked(receiptsApi.list).mock.calls.at(-1)![0].get("status"),
    ).toBe("RECEIVED,PLACING,PLACED,CONFLICT"),
  );
  expect(
    vi.mocked(receiptsApi.list).mock.calls.at(-1)![0].has("hasConflict"),
  ).toBe(false);
  for (const name of [
    "Ожидает размещения",
    "Частично размещён",
    "Размещён",
    "Конфликт с 1С",
  ])
    fireEvent.click(screen.getByRole("option", { name }));
  await waitFor(() =>
    expect(
      vi.mocked(receiptsApi.list).mock.calls.at(-1)![0].get("status"),
    ).toBe("RECEIVED,PLACING,PLACED,CANCELLED"),
  );
});
