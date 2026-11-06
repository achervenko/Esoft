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
it("loads further pages without navigation and windows accumulated rows", async () => {
  const items = Array.from({ length: 50 }, (_, index) => ({
    ...receipt,
    id: String(index + 1),
    documentNumber: `Документ ${index + 1}`,
  }));
  vi.mocked(receiptsApi.list)
    .mockResolvedValueOnce({ items, total: 51, page: 1, limit: 50 })
    .mockRejectedValueOnce(Error("Ошибка следующей страницы"))
    .mockResolvedValueOnce({
      items: [{ ...receipt, id: "51", documentNumber: "Документ 51" }],
      total: 51,
      page: 2,
      limit: 50,
    });
  const { container } = render(
    <TestReceiptList userPermissions={permissions} />,
  );
  await screen.findByText("Документ 1");
  expect(
    screen.queryByRole("button", { name: "Обновить" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Далее" }),
  ).not.toBeInTheDocument();
  expect(container.querySelector("table")).toHaveClass("data-table-windowed");
  fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
  await screen.findByText("Ошибка следующей страницы");
  expect(screen.getByText("Документ 1")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Повторить загрузку" }));
  await screen.findByText("Показано 51 из 51");
  expect(vi.mocked(receiptsApi.list).mock.calls[1][0].get("page")).toBe("2");
  expect(vi.mocked(receiptsApi.list).mock.calls[2][0].get("page")).toBe("2");
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "новый" },
  });
  await waitFor(() =>
    expect(
      vi.mocked(receiptsApi.list).mock.calls.at(-1)![0].get("search"),
    ).toBe("новый"),
  );
  expect(vi.mocked(receiptsApi.list).mock.calls.at(-1)![0].get("page")).toBe(
    "1",
  );
});

it("keeps only a window of rows mounted after accumulating three pages", async () => {
  vi.mocked(receiptsApi.list).mockImplementation(async (params) => {
    const page = Number(params.get("page"));
    return {
      items: Array.from({ length: 50 }, (_, index) => ({
        ...receipt,
        id: String((page - 1) * 50 + index),
        documentNumber: `Лист ${(page - 1) * 50 + index}`,
      })),
      total: 150,
      limit: 50,
      page,
    };
  });
  const { container } = render(
    <TestReceiptList userPermissions={permissions} />,
  );
  await screen.findByText("Показано 50 из 150");
  fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
  await screen.findByText("Показано 100 из 150");
  fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
  await screen.findByText("Показано 150 из 150");
  expect(
    container.querySelectorAll("tbody tr[data-grid-index]").length,
  ).toBeLessThan(100);
});
