import { render, item } from "./storage-locations-panel-test-context";
import { storageLocationsApi } from "../../shared/api/storage-locations-api";
import { StorageLocationsPanel } from "./StorageLocationsPanel";

import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { it, expect, vi } from "vitest";

it("keeps the same table and row mounted while changing warehouse, including an unchanged response", async () => {
  render(<StorageLocationsPanel canManage />);
  const rowLabel = await screen.findByText("Полка");
  const table = rowLabel.closest("table");
  const row = rowLabel.closest("tr");
  let resolve!: (result: {
    items: (typeof item)[];
    total: number;
    page: number;
    limit: number;
  }) => void;
  vi.mocked(storageLocationsApi.list).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  fireEvent.click(
    within(screen.getAllByRole("table")[0]).getByText("Основной склад"),
  );
  expect(screen.getByText("Полка").closest("table")).toBe(table);
  expect(screen.getByText("Полка").closest("tr")).toBe(row);
  expect(screen.queryByText("Загрузка…")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Удалить место Полка" }),
  ).toBeDisabled();
  await act(async () =>
    resolve({ items: [{ ...item }], total: 1, page: 1, limit: 50 }),
  );
  expect(screen.getByText("Полка").closest("tr")).toBe(row);
  expect(
    screen.getByRole("button", { name: "Удалить место Полка" }),
  ).not.toBeDisabled();
});

it("retains the table on a warehouse refresh failure and offers a retry", async () => {
  render(<StorageLocationsPanel canManage />);
  const table = (await screen.findByText("Полка")).closest("table");
  vi.mocked(storageLocationsApi.list).mockRejectedValueOnce(
    new Error("Нет связи"),
  );
  fireEvent.click(
    within(screen.getAllByRole("table")[0]).getByText("Основной склад"),
  );
  await screen.findByText("Нет связи");
  expect(screen.getByText("Полка").closest("table")).toBe(table);
  expect(
    screen.getByRole("button", { name: "Удалить место Полка" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Повторить загрузку" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Удалить место Полка" }),
    ).not.toBeDisabled(),
  );
  expect(screen.queryByText("Нет связи")).toBeNull();
});
