import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import * as api from "../../shared/api/search-api";
import { SearchPage } from "./SearchPage";
import { result, setupSearchPageTests } from "./search-page-test-utils";

setupSearchPageTests();

it("appends the next page without removing existing rows", async () => {
  const first = Array.from({ length: 20 }, (_, id) => ({ ...result(`насос ${id}`), id: String(id), entityId: id }));
  const search = vi.spyOn(api, "searchApp").mockResolvedValueOnce(first)
    .mockResolvedValueOnce([{ ...result("насос 20"), id: "20", entityId: 20 }]);
  render(<SearchPage />);
  const link = await screen.findByRole("link", { name: /насос 0/ });
  fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
  expect(screen.getByRole("link", { name: /насос 0/ })).toBe(link);
  expect(await screen.findByText("насос 20")).toBeInTheDocument();
  expect(screen.getAllByRole("link")).toHaveLength(21);
  expect(search.mock.calls[1][0].offset).toBe(20);
});

it("keeps rows visible and shows a delayed loader below them during pagination", async () => {
  let resolve!: (items: api.SearchResultItem[]) => void;
  vi.spyOn(api, "searchApp").mockResolvedValueOnce(
    Array.from({ length: 20 }, (_, id) => ({ ...result(`насос ${id}`), id: String(id), entityId: id })),
  ).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  const { container } = render(<SearchPage />);
  const link = await screen.findByRole("link", { name: /насос 0/ });
  await act(async () => { await new Promise((done) => setTimeout(done, 500)); });
  fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
  expect(screen.getByRole("link", { name: /насос 0/ })).toBe(link);
  const status = await screen.findByRole("status");
  expect(container.querySelector(".search-loading-footer")).toContainElement(status);
  await act(async () => { resolve([]); });
  expect(screen.getByRole("link", { name: /насос 0/ })).toBe(link);
  await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
});

it("explains the pagination limit and stops requesting further pages", async () => {
  const search = vi.spyOn(api, "searchApp").mockImplementation(async ({ offset = 0 }) =>
    Array.from({ length: 20 }, (_, index) => {
      const id = offset + index;
      return { ...result(`насос ${id}`), id: String(id), entityId: id };
    }),
  );
  render(<SearchPage />);
  await screen.findByText("насос 19");
  for (let offset = 20; offset <= 1000; offset += 20) {
    fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
    await screen.findByText(`насос ${offset + 19}`);
  }
  expect(screen.getByText(/Показаны первые 1020 результатов/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Показать ещё" })).not.toBeInTheDocument();
  expect(search.mock.calls.at(-1)?.[0].offset).toBe(1000);
}, 30000);
