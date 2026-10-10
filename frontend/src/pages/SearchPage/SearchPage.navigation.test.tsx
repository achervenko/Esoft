import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import * as api from "../../shared/api/search-api";
import { SearchPage } from "./SearchPage";
import { result, navigate, setupSearchPageTests } from "./search-page-test-utils";

setupSearchPageTests();

it("updates input and results when the query changes without remounting", async () => {
  const search = vi.spyOn(api, "searchApp").mockImplementation(async ({ query }) => [result(query)]);
  render(<SearchPage />);
  expect(await screen.findByText("насос")).toBeInTheDocument();
  navigate("#/search?q=станок");
  expect(screen.getByRole("searchbox", { name: "Поиск" })).toHaveValue("станок");
  expect(screen.getByText("насос")).toBeInTheDocument();
  expect(await screen.findByText("станок")).toBeInTheDocument();
  expect(search).toHaveBeenLastCalledWith({ limit: 20, offset: 0, query: "станок", signal: expect.any(AbortSignal) });
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
  await waitFor(() => expect(search).toHaveBeenCalledExactlyOnceWith({ limit: 20, offset: 0, query: "новый станок", signal: expect.any(AbortSignal) }));
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
  expect(search.mock.calls[0][0].signal?.aborted).toBe(true);
  expect(await screen.findByText("станок")).toBeInTheDocument();
  await act(async () => { resolve([result("насос")]); });
  expect(screen.queryByText("насос")).not.toBeInTheDocument();
  expect(screen.getByText("станок")).toBeInTheDocument();
});

it("shows PPE and employee results with the appropriate routes", async () => {
  vi.spyOn(api, "searchApp").mockResolvedValue([
    { ...result("Куртка"), entityType: "ppe_item", entityId: 3, subtitle: "Артикул: 3.955", targetUrl: "#/ppe?tab=catalog&q=3.955" },
    { ...result("Иванов Иван"), entityType: "employee", entityId: 4, subtitle: "Инженер", targetUrl: "#/ppe/employees/4" },
  ]);
  render(<SearchPage />);
  const ppeLink = await screen.findByRole("link", { name: /Куртка/ });
  const targetParams = new URLSearchParams(ppeLink.getAttribute("href")!.split("?")[1]);
  expect(targetParams.get("tab")).toBe("catalog");
  expect(targetParams.get("q")).toBe("3.955");
  expect(targetParams.get("returnTo")).toBe(window.location.hash);
  const employeeHref = screen.getByRole("link", { name: /Иванов Иван/ }).getAttribute("href")!;
  expect(employeeHref.split("?")[0]).toBe("#/ppe/employees/4");
  expect(new URLSearchParams(employeeHref.split("?")[1]).get("returnTo")).toBe(window.location.hash);
  expect(screen.getByText("Артикул: 3.955")).toBeInTheDocument();
  expect(screen.getByText("Инженер")).toBeInTheDocument();
});

it("remembers a viewed PPE result when returning to the saved search", async () => {
  sessionStorage.removeItem("search-viewed-results");
  vi.spyOn(api, "searchApp").mockResolvedValue([{ ...result("Куртка"), entityType: "ppe_item", targetUrl: "#/ppe?tab=catalog&itemId=1" }]);
  const view = render(<SearchPage />);
  const link = await screen.findByRole("link", { name: /Куртка/ });
  link.addEventListener("click", (event) => event.preventDefault());
  fireEvent.click(link);
  view.unmount();
  render(<SearchPage />);
  expect(await screen.findByRole("link", { name: /Куртка/ })).toHaveClass("search-result-visited");
  sessionStorage.removeItem("search-viewed-results");
});
