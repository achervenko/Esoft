import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import * as api from "../../shared/api/search-api";
import { SearchPage } from "./SearchPage";
import { result, setupSearchPageTests } from "./search-page-test-utils";

setupSearchPageTests();

it("changes admin module scope and invalidates cached exact results", async () => {
  const search = vi.spyOn(api, "searchApp").mockResolvedValue([{ ...result("насос"), score: 400, searchText: "насос" }]);
  render(<SearchPage userRole="admin" />);
  await screen.findByText("насос");
  fireEvent.click(screen.getByRole("button", { name: "Фильтры" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Оборудование" }));
  fireEvent.click(screen.getByRole("button", { name: "Применить" }));
  await waitFor(() => expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ module: "ppe", offset: 0 })));
  expect(window.location.hash).toContain("module=ppe");
  expect(screen.getByRole("button", { name: "Фильтры" })).toHaveClass("ppe-journal-filter-active");
});

it("offers filters to a PPE specialist without a module choice", () => {
  vi.spyOn(api, "searchApp").mockResolvedValue([]);
  render(<SearchPage userRole="ppe_specialist" />);
  fireEvent.click(screen.getByRole("button", { name: "Фильтры" }));
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(screen.getByText(/Поиск выполняется в модуле «СИЗ»/)).toBeInTheDocument();
});
