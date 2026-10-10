import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import * as api from "../../shared/api/search-api";
import { SearchPage } from "./SearchPage";
import { result, setupSearchPageTests } from "./search-page-test-utils";

setupSearchPageTests();

it("retries a failed next page at the same offset without clearing cards", async () => {
  const first = Array.from({ length: 20 }, (_, id) => ({ ...result(`насос ${id}`), id: String(id), entityId: id }));
  const search = vi.spyOn(api, "searchApp").mockResolvedValueOnce(first)
    .mockRejectedValueOnce(new Error("Сбой загрузки"))
    .mockResolvedValueOnce([{ ...result("насос 20"), id: "20", entityId: 20 }]);
  render(<SearchPage />);
  const link = await screen.findByRole("link", { name: /насос 0/ });
  fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Повторить загрузку" }));
  expect(screen.getByRole("link", { name: /насос 0/ })).toBe(link);
  await screen.findByText("насос 20");
  expect(search.mock.calls.map(([params]) => params.offset)).toEqual([0, 20, 20]);
  expect(screen.getAllByRole("link")).toHaveLength(21);
});

it("retries an initial failed search", async () => {
  vi.spyOn(api, "searchApp").mockRejectedValueOnce(new Error("Сбой загрузки")).mockResolvedValueOnce([result("насос")]);
  render(<SearchPage />);
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Повторить загрузку" }));
  expect(await screen.findByText("насос")).toBeInTheDocument();
});

it("clears stale results after a new search fails and retries the new query", async () => {
  const search = vi.spyOn(api, "searchApp").mockResolvedValueOnce([result("насос")])
    .mockRejectedValueOnce(new Error("Сбой загрузки"))
    .mockResolvedValueOnce([result("Куртка")]);
  render(<SearchPage />);
  await screen.findByText("насос");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "куртка" } });
  expect(screen.getByText("насос")).toBeInTheDocument();
  await screen.findByRole("alert");
  expect(screen.queryByText("насос")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Повторить загрузку" }));
  await screen.findByText("Куртка");
  expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ query: "куртка", offset: 0 }));
});
