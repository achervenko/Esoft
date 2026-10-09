import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as api from "../../shared/api/search-api";
import { SearchPage } from "./SearchPage";

beforeEach(() => window.history.replaceState({ marker: "keep" }, "", "#/search?q=насос"));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function result(title: string): api.SearchResultItem {
  return {
    id: title, title, entityId: 1, entityType: "equipment", score: 1,
    subtitle: null, targetUrl: "#/equipment/1",
    details: { location: null, manufacturer: null, model: null, responsible: null, serialNumber: null, status: null },
  };
}
function navigate(hash: string) {
  act(() => {
    window.history.replaceState(window.history.state, "", hash);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}

it("updates input and results when the query changes without remounting", async () => {
  const search = vi.spyOn(api, "searchApp").mockImplementation(async ({ query }) => [result(query)]);
  render(<SearchPage />);
  expect(await screen.findByText("насос")).toBeInTheDocument();
  navigate("#/search?q=станок");
  expect(screen.getByRole("searchbox", { name: "Поиск" })).toHaveValue("станок");
  expect(screen.queryByText("насос")).not.toBeInTheDocument();
  expect(await screen.findByText("станок")).toBeInTheDocument();
  expect(search).toHaveBeenLastCalledWith({ limit: 20, offset: 0, query: "станок" });
  navigate("#/search");
  expect(screen.getByRole("searchbox", { name: "Поиск" })).toHaveValue("");
  expect(screen.queryByText("станок")).not.toBeInTheDocument();
  expect(search).toHaveBeenCalledTimes(2);
});

it("writes input changes to the address while preserving history metadata", async () => {
  const search = vi.spyOn(api, "searchApp").mockResolvedValue([]);
  render(<SearchPage />);
  const input = screen.getByRole("searchbox", { name: "Поиск" });
  fireEvent.change(input, { target: { value: " новый станок " } });
  expect(window.location.hash).toBe("#/search?q=" + encodeURIComponent("новый станок"));
  expect(window.history.state).toEqual({ marker: "keep" });
  expect(input).toHaveValue(" новый станок ");
  await waitFor(() => expect(search).toHaveBeenCalledExactlyOnceWith({ limit: 20, offset: 0, query: "новый станок" }));
  fireEvent.change(input, { target: { value: "" } });
  expect(window.location.hash).toBe("#/search");
});

it("synchronizes browser back and forward navigation", async () => {
  vi.spyOn(api, "searchApp").mockResolvedValue([]);
  window.history.pushState(null, "", "#/search?q=станок");
  render(<SearchPage />);
  expect(screen.getByRole("searchbox", { name: "Поиск" })).toHaveValue("станок");
  act(() => window.history.back());
  await waitFor(() => expect(screen.getByRole("searchbox", { name: "Поиск" })).toHaveValue("насос"));
  act(() => window.history.forward());
  await waitFor(() => expect(screen.getByRole("searchbox", { name: "Поиск" })).toHaveValue("станок"));
});

it("ignores an old response after address navigation", async () => {
  let resolve!: (items: api.SearchResultItem[]) => void;
  const search = vi.spyOn(api, "searchApp")
    .mockReturnValueOnce(new Promise((yes) => { resolve = yes; }))
    .mockResolvedValueOnce([result("станок")]);
  render(<SearchPage />);
  await waitFor(() => expect(search).toHaveBeenCalledOnce());
  navigate("#/search?q=станок");
  expect(await screen.findByText("станок")).toBeInTheDocument();
  await act(async () => { resolve([result("насос")]); });
  expect(screen.queryByText("насос")).not.toBeInTheDocument();
  expect(screen.getByText("станок")).toBeInTheDocument();
});
