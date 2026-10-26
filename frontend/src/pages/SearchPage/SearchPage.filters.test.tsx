import { permissionsForTest } from "../../test/permission-fixtures";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { expect, it, vi } from "vitest";
import * as api from "../../shared/api/search-api";
import { SearchPage } from "./SearchPage";
import { result, setupSearchPageTests } from "./search-page-test-utils";

setupSearchPageTests();

it("changes admin module scope and invalidates cached exact results", async () => {
  const search = vi
    .spyOn(api, "searchApp")
    .mockResolvedValue([
      { ...result("насос"), score: 400, searchText: "насос" },
    ]);
  render(<SearchPage userPermissions={permissionsForTest("admin")} />);
  await screen.findByText("насос");
  fireEvent.click(screen.getByRole("button", { name: "Фильтры" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Оборудование" }));
  fireEvent.click(screen.getByRole("button", { name: "Применить" }));
  await waitFor(() =>
    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({ module: "ppe", offset: 0 }),
    ),
  );
  expect(window.location.hash).toContain("module=ppe");
  expect(screen.getByRole("button", { name: "Фильтры" })).toHaveClass(
    "search-toolbar-filter-active",
  );
});

it("offers filters to a PPE specialist without a module choice", () => {
  vi.spyOn(api, "searchApp").mockResolvedValue([]);
  render(<SearchPage userPermissions={permissionsForTest("ppe_specialist")} />);
  fireEvent.click(screen.getByRole("button", { name: "Фильтры" }));
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(
    screen.getByText(/Поиск выполняется в модуле «СИЗ»/),
  ).toBeInTheDocument();
});

it("does not request an old pagination offset under a new module filter", async () => {
  let resolveInitial!: (items: api.SearchResultItem[]) => void;
  const initialPpe = new Promise<api.SearchResultItem[]>((resolve) => {
    resolveInitial = resolve;
  });
  const search = vi
    .spyOn(api, "searchApp")
    .mockImplementation(async ({ module, offset = 0 }) => {
      if (module === "ppe" && offset === 0) return initialPpe;
      if (module === "ppe")
        return [
          {
            ...result("Следующая страница СИЗ"),
            entityType: "ppe_item",
            entityId: 100,
          },
        ];
      return Array.from({ length: 20 }, (_, index) => ({
        ...result(`насос ${offset + index}`),
        entityId: offset + index,
        id: String(offset + index),
      }));
    });
  render(<SearchPage userPermissions={permissionsForTest("admin")} />);
  await screen.findByText("насос 19");
  fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
  await screen.findByText("насос 39");
  fireEvent.click(screen.getByRole("button", { name: "Фильтры" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Оборудование" }));
  fireEvent.click(screen.getByRole("button", { name: "Применить" }));
  await waitFor(() =>
    expect(search).toHaveBeenLastCalledWith(
      expect.objectContaining({ module: "ppe", offset: 0 }),
    ),
  );
  expect(
    search.mock.calls
      .filter(([params]) => params.module === "ppe")
      .map(([params]) => params.offset),
  ).toEqual([0]);
  expect(
    screen.queryByRole("button", { name: "Показать ещё" }),
  ).not.toBeInTheDocument();
  await act(async () => {
    resolveInitial(
      Array.from({ length: 20 }, (_, index) => ({
        ...result(`СИЗ ${index}`),
        entityType: "ppe_item",
        entityId: index,
        id: String(index),
      })),
    );
  });
  fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
  await screen.findByText("Следующая страница СИЗ");
  expect(
    search.mock.calls
      .filter(([params]) => params.module === "ppe")
      .map(([params]) => params.offset),
  ).toEqual([0, 20]);
});
