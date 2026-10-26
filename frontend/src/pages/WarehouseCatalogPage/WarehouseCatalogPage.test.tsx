import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { WarehouseCatalogPage } from "./WarehouseCatalogPage";
import { warehouseCatalogApi } from "../../shared/api/warehouse-catalog-api";

import {
  item,
  permissions,
  renderWarehouse as render,
  setupWarehouseCatalogTests,
} from "./warehouse-catalog-test-utils";
setupWarehouseCatalogTests();

it("does not fetch or offer actions without permission", () => {
  render(<WarehouseCatalogPage userPermissions={[]} />);
  expect(screen.getByText(/Недостаточно прав/)).toBeTruthy();
  expect(warehouseCatalogApi.list).not.toHaveBeenCalled();
});

it("shows cards with photo placeholders and no comment or status badge", async () => {
  render(<WarehouseCatalogPage userPermissions={permissions} />);
  expect(screen.getByRole("status")).toBeTruthy();
  await screen.findByText(item.article);
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.getByRole("heading", { name: item.article })).toBeTruthy();
  expect(screen.getByText(item.name)).toBeTruthy();
  expect(
    screen.getByRole("img", { name: "Фотография скоро появится" }),
  ).toBeTruthy();
  expect(screen.queryByText(item.comment!)).toBeNull();
  expect(screen.queryByText("Активна", { exact: true })).toBeNull();
  expect(screen.queryByRole("button", { name: /Сортировать/ })).toBeNull();
  expect(
    screen.getByRole("button", { name: "Добавить номенклатуру" }).textContent,
  ).toContain("Добавить");
});

it("debounces server search and resets pagination and filters on the server", async () => {
  vi.mocked(warehouseCatalogApi.list).mockResolvedValue({
    items: [item],
    total: 101,
    limit: 50,
    offset: 0,
  });
  render(<WarehouseCatalogPage userPermissions={permissions} />);
  await screen.findByText(item.article);
  fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
  await waitFor(() =>
    expect(
      vi.mocked(warehouseCatalogApi.list).mock.lastCall?.[0].get("offset"),
    ).toBe("50"),
  );
  await screen.findByText(item.article);
  const search = screen.getByRole("searchbox");
  fireEvent.change(search, { target: { value: "ре" } });
  fireEvent.change(search, { target: { value: "редуктор" } });
  await waitFor(() =>
    expect(
      vi.mocked(warehouseCatalogApi.list).mock.lastCall?.[0].get("q"),
    ).toBe("редуктор"),
  );
  expect(
    vi.mocked(warehouseCatalogApi.list).mock.lastCall?.[0].get("offset"),
  ).toBe("0");
  expect(
    vi
      .mocked(warehouseCatalogApi.list)
      .mock.calls.some(([q]) => q.get("q") === "ре"),
  ).toBe(false);
  fireEvent.click(
    screen.getByRole("button", { name: "Настройки поиска номенклатуры" }),
  );
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByLabelText("Активные"));
  fireEvent.click(within(dialog).getByRole("button", { name: "Применить" }));
  await waitFor(() =>
    expect(
      vi.mocked(warehouseCatalogApi.list).mock.lastCall?.[0].get("isActive"),
    ).toBe("false"),
  );
  expect(window.location.hash).toContain("isActive=false");
});

it("retries a load failure", async () => {
  vi.mocked(warehouseCatalogApi.list).mockRejectedValueOnce(
    new Error("Список недоступен"),
  );
  render(<WarehouseCatalogPage userPermissions={permissions} />);
  await screen.findByText("Список недоступен");
  fireEvent.click(screen.getByRole("button", { name: "Повторить загрузку" }));
  await screen.findByText(item.article);
});

it("keeps previous cards on a next-batch failure and appends the retried batch", async () => {
  const first = Array.from({ length: 50 }, (_, i) => ({
    ...item,
    id: String(9007199254740993n + BigInt(i)),
    article: `BATCH-${i}`,
  }));
  const last = { ...item, id: "9007199254741093", article: "LAST-BATCH" };
  vi.mocked(warehouseCatalogApi.list)
    .mockResolvedValueOnce({ items: first, total: 51, limit: 50, offset: 0 })
    .mockRejectedValueOnce(new Error("Следующая порция недоступна"))
    .mockResolvedValueOnce({ items: [last], total: 51, limit: 50, offset: 50 });
  render(<WarehouseCatalogPage userPermissions={permissions} />);
  await screen.findByText("Показано 50 из 51");
  expect(
    screen.queryByRole("navigation", { name: "Страницы номенклатуры" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
  await screen.findByText("Следующая порция недоступна");
  expect(screen.getAllByRole("listitem")).toHaveLength(50);
  fireEvent.click(screen.getByRole("button", { name: "Повторить загрузку" }));
  await screen.findByText("Показано 51 из 51");
  expect(screen.getByText("BATCH-0")).toBeTruthy();
  expect(screen.getByText(last.article)).toBeTruthy();
  expect(screen.getAllByRole("listitem")).toHaveLength(51);
  expect(screen.queryByRole("button", { name: "Показать ещё" })).toBeNull();
  expect(
    vi
      .mocked(warehouseCatalogApi.list)
      .mock.calls.map(([q]) => q.get("offset")),
  ).toEqual(["0", "50", "50"]);
});

it("distinguishes an empty catalog from a filtered empty result", async () => {
  vi.mocked(warehouseCatalogApi.list).mockResolvedValue({
    items: [],
    total: 0,
    limit: 50,
    offset: 0,
  });
  render(<WarehouseCatalogPage userPermissions={permissions} />);
  await screen.findByText("Номенклатура пока не добавлена.");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "нет" } });
  await screen.findByText("По заданным условиям ничего не найдено.");
});

it("uses the shared inactive surface for inactive cards", async () => {
  const inactive = { ...item, id: "15", article: "INACTIVE", isActive: false };
  vi.mocked(warehouseCatalogApi.list).mockResolvedValue({
    items: [item, inactive],
    total: 2,
    limit: 50,
    offset: 0,
  });
  render(<WarehouseCatalogPage userPermissions={permissions} />);
  await screen.findByText(item.article);
  const activeCard = screen.getByRole("listitem", { name: item.article });
  const inactiveCard = screen.getByRole("listitem", { name: inactive.article });
  expect(activeCard).not.toHaveClass("inactive-surface");
  expect(inactiveCard).toHaveClass("inactive-surface");
  expect(
    screen.getAllByRole("img", { name: "Фотография скоро появится" }),
  ).toHaveLength(2);
  expect(
    within(inactiveCard).getByRole("button", { name: "Изменить" }),
  ).toBeEnabled();
});

it("treats both selected statuses as all instead of dropping a selection", async () => {
  window.history.replaceState(null, "", "#/warehouse/catalog?isActive=false");
  render(<WarehouseCatalogPage userPermissions={permissions} />);
  await screen.findByText(item.article);
  expect(
    vi.mocked(warehouseCatalogApi.list).mock.lastCall?.[0].get("isActive"),
  ).toBe("false");
  fireEvent.click(
    screen.getByRole("button", { name: "Настройки поиска номенклатуры" }),
  );
  const dialog = screen.getByRole("dialog");
  expect(
    within(dialog).getByRole("checkbox", { name: "Неактивные" }),
  ).toBeChecked();
  fireEvent.click(within(dialog).getByRole("checkbox", { name: "Активные" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Применить" }));
  await waitFor(() =>
    expect(
      vi.mocked(warehouseCatalogApi.list).mock.lastCall?.[0].has("isActive"),
    ).toBe(false),
  );
});
