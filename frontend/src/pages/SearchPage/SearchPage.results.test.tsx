import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import * as api from "../../shared/api/search-api";
import { SearchPage } from "./SearchPage";
import { result, navigate, setupSearchPageTests } from "./search-page-test-utils";

setupSearchPageTests();

it("keeps matching rows while refreshing an extended employee name", async () => {
  navigate("#/search?q=Со");
  const search = vi.spyOn(api, "searchApp").mockResolvedValue([
    { ...result("Соколкин Алексей Игоревич"), entityType: "employee", searchText: "соколкин алексей игоревич" },
    { ...result("Соколов Иван"), entityType: "employee", entityId: 2, searchText: "соколов иван" },
  ]);
  render(<SearchPage />);
  const link = await screen.findByRole("link", { name: /Соколкин/ });
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Соколкин Алекс" } });
  expect(screen.getByRole("link", { name: /Соколкин/ })).toBe(link);
  expect(screen.getByRole("link", { name: /Соколов/ })).toBeInTheDocument();
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)); });
  expect(search).toHaveBeenCalledTimes(2);
});

it("requests refined results when the previous response reached the limit", async () => {
  const search = vi.spyOn(api, "searchApp").mockResolvedValue(
    Array.from({ length: 20 }, (_, id) => ({ ...result(`насос ${id}`), entityId: id, searchText: `насос ${id}` })),
  );
  render(<SearchPage />);
  await screen.findByText("насос 0");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "насос 1" } });
  await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
});

it("does not mutate an unchanged card after an exact-match response", async () => {
  const item = { ...result("Соколкин Алексей"), entityType: "employee", searchText: "соколкин алексей", targetUrl: "#/ppe/employees/1" };
  const search = vi.spyOn(api, "searchApp").mockResolvedValueOnce([item]).mockResolvedValueOnce([{ ...item, score: 400 }]);
  navigate("#/search?q=Со");
  render(<SearchPage />);
  const link = await screen.findByRole("link", { name: /Соколкин/ });
  const mutations: MutationRecord[] = [];
  const observer = new MutationObserver((records) => mutations.push(...records));
  observer.observe(link.closest("li")!, { childList: true, subtree: true, attributes: true, characterData: true });
  try {
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Соколкин Алексей" } });
    await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("link", { name: /Соколкин/ })).toBe(link);
    expect(mutations).toHaveLength(0);
  } finally { observer.disconnect(); }
});

it.each(["соклкин", "сок"])("keeps a fuzzy result mounted while query %s is pending", async (query) => {
  const item = { ...result("Соколкин Алексей"), entityType: "employee", searchText: "соколкин алексей", targetUrl: "#/ppe/employees/1" };
  let resolve!: (items: api.SearchResultItem[]) => void;
  const search = vi.spyOn(api, "searchApp").mockResolvedValueOnce([item])
    .mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  navigate("#/search?q=соколкин");
  render(<SearchPage />);
  const link = await screen.findByRole("link", { name: /Соколкин/ });
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: query } });
  await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
  expect(screen.getByRole("link", { name: /Соколкин/ })).toBe(link);
  await act(async () => { resolve([{ ...item }]); });
  expect(screen.getByRole("link", { name: /Соколкин/ })).toBe(link);
});

it("refreshes complete exact results to include newly relevant fuzzy matches", async () => {
  const item = { ...result("Соколкин Алексей"), entityType: "employee", searchText: "соколкин алексей", score: 200, targetUrl: "#/ppe/employees/1" };
  const search = vi.spyOn(api, "searchApp").mockResolvedValue([item]);
  navigate("#/search?q=со");
  render(<SearchPage />);
  const link = await screen.findByRole("link", { name: /Соколкин/ });
  await act(async () => { await new Promise((done) => setTimeout(done, 500)); });
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "соколкин" } });
  expect(screen.getByRole("link", { name: /Соколкин/ })).toBe(link);
  await act(async () => { await new Promise((done) => setTimeout(done, 300)); });
  expect(search).toHaveBeenCalledTimes(2);
  await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
});

it("falls back to fuzzy search when exact cached matches disappear", async () => {
  const item = { ...result("Соколкин Алексей"), entityType: "employee", searchText: "соколкин алексей", score: 300, targetUrl: "#/ppe/employees/1" };
  let resolve!: (items: api.SearchResultItem[]) => void;
  const search = vi.spyOn(api, "searchApp").mockResolvedValueOnce([item])
    .mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  navigate("#/search?q=со");
  render(<SearchPage />);
  const link = await screen.findByRole("link", { name: /Соколкин/ });
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "соколктн" } });
  expect(screen.getByRole("link", { name: /Соколкин/ })).toBe(link);
  await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
  expect(search.mock.calls[1][0].query).toBe("соколктн");
  await act(async () => { resolve([{ ...item, score: 0.2 }]); });
  expect(screen.getByRole("link", { name: /Соколкин/ })).toBe(link);
});

it("uses the server ranking when an exact match becomes more relevant", async () => {
  const first = { ...result("Куртка рабочая"), id: "1", entityId: 1, score: 300, searchText: "куртка рабочая" };
  const second = { ...result("Куртка"), id: "2", entityId: 2, score: 200, searchText: "куртка" };
  vi.spyOn(api, "searchApp").mockResolvedValueOnce([first, second]).mockResolvedValueOnce([{ ...second, score: 400 }, first]);
  navigate("#/search?q=кур");
  render(<SearchPage />);
  await screen.findByText("Куртка рабочая");
  const exactLink = screen.getByText(/^Куртка$/).closest("a")!;
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "куртка" } });
  await waitFor(() => expect(screen.getAllByRole("link")[0]).toBe(exactLink));
});

it("does not repeat a request for case and whitespace changes", async () => {
  const search = vi.spyOn(api, "searchApp").mockResolvedValue([result("насос")]);
  render(<SearchPage />);
  await screen.findByText("насос");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "  НАСОС  " } });
  await act(async () => { await new Promise((done) => setTimeout(done, 300)); });
  expect(search).toHaveBeenCalledOnce();
});

it("includes new fuzzy matches even while an exact result still exists", async () => {
  const exact = { ...result("Куртка"), id: "1", entityId: 1, score: 300, searchText: "куртка" };
  const fuzzy = { ...result("Курточка"), id: "2", entityId: 2, score: 0.5, searchText: "курточка" };
  const search = vi.spyOn(api, "searchApp").mockResolvedValueOnce([exact]).mockResolvedValueOnce([exact, fuzzy]);
  navigate("#/search?q=ку");
  render(<SearchPage />);
  await screen.findByText("Куртка");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "куртка" } });
  expect(await screen.findByText("Курточка")).toBeInTheDocument();
  expect(search).toHaveBeenCalledTimes(2);
});
