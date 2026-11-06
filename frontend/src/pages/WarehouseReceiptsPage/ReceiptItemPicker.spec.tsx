import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ReceiptItemPicker } from "./ReceiptItemPicker";
import {
  warehouseCatalogApi,
  type WarehouseItem,
} from "../../shared/api/warehouse-catalog-api";
import { useState } from "react";
vi.mock("../../shared/api/warehouse-catalog-api", () => ({
  warehouseCatalogApi: { list: vi.fn() },
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("offers creation only after a nonempty search finishes without matches", async () => {
  vi.mocked(warehouseCatalogApi.list).mockImplementation(async (query) => ({
    items:
      query.get("q") === "found"
        ? [
            {
              id: "1",
              article: "found",
              name: "Товар",
              unit: "шт",
              isActive: true,
              comment: null,
            },
          ]
        : [],
    total: query.get("q") === "found" ? 1 : 0,
    offset: 0,
    limit: 50,
  }));
  const onCreate = vi.fn();
  render(
    <ReceiptItemPicker value={null} onChange={vi.fn()} onCreate={onCreate} />,
  );
  const create = () =>
    screen.queryByRole("button", { name: "Создать номенклатуру" });
  expect(create()).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "found" },
  });
  await screen.findByRole("option", { name: "found — Товар" });
  expect(create()).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "missing" },
  });
  expect(create()).not.toBeInTheDocument();
  fireEvent.click(
    await screen.findByRole("button", { name: "Создать номенклатуру" }),
  );
  expect(onCreate).toHaveBeenCalledWith("missing");
});
it("searches a 50,000 item catalog in bounded batches and preserves bigint item IDs", async () => {
  const item = {
    id: "9007199254740995",
    article: "LAST-50000",
    name: "Последняя позиция",
    unit: "шт",
    isActive: true,
    comment: null,
  };
  vi.mocked(warehouseCatalogApi.list).mockResolvedValue({
    items: [item],
    total: 50000,
    offset: 0,
    limit: 50,
  });
  const selected = vi.fn();
  function Picker() {
    const [value, setValue] = useState<WarehouseItem | null>(null);
    return (
      <ReceiptItemPicker
        value={value}
        onChange={(next) => {
          setValue(next);
          selected(next);
        }}
      />
    );
  }
  render(<Picker />);
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "LAST-50000" },
  });
  fireEvent.click(
    await screen.findByRole("option", {
      name: "LAST-50000 — Последняя позиция",
    }),
  );
  expect(selected).toHaveBeenLastCalledWith(item);
  expect(warehouseCatalogApi.list).toHaveBeenCalledTimes(1);
  expect(
    vi.mocked(warehouseCatalogApi.list).mock.calls[0][0].get("limit"),
  ).toBe("50");
});
it("uses server-side q search and does not block a document when the next item is unselected", async () => {
  vi.mocked(warehouseCatalogApi.list).mockResolvedValue({
    items: [],
    total: 0,
    offset: 0,
    limit: 50,
  });
  render(
    <form aria-label="Документ">
      <ReceiptItemPicker value={null} onChange={vi.fn()} />
    </form>,
  );
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "6205" },
  });
  await waitFor(() => expect(warehouseCatalogApi.list).toHaveBeenCalled());
  const query = vi.mocked(warehouseCatalogApi.list).mock.calls.at(-1)![0];
  expect(query.get("q")).toBe("6205");
  expect(query.get("limit")).toBe("50");
  expect(query.has("search")).toBe(false);
  expect((screen.getByRole("form") as HTMLFormElement).checkValidity()).toBe(
    true,
  );
});
