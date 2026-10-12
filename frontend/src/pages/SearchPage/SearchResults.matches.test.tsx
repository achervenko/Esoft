import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { SearchResults } from "./SearchResults";
import { result, setupSearchPageTests } from "./search-page-test-utils";

setupSearchPageTests();

it("updates returnTo and visited state when the query changes with the same items", () => {
  const items = [result("Станок")];
  window.history.replaceState(null, "", "#/search?q=станок");
  const view = render(<SearchResults items={items} query="станок" />);
  const link = screen.getByRole("link");
  fireEvent.click(link);
  expect(link).toHaveClass("search-result-visited");
  window.history.replaceState(null, "", "#/search?q=стан");
  view.rerender(<SearchResults items={items} query="стан" />);
  const updated = screen.getByRole("link");
  expect(updated).not.toHaveClass("search-result-visited");
  const href = updated.getAttribute("href") ?? "";
  expect(new URLSearchParams(href.split("?")[1]).get("returnTo")).toBe(window.location.hash);
});

it("shows hidden matches alongside visible matches without repeating displayed values", () => {
  render(<SearchResults items={[{ ...result("Насос Siemens"), subtitle: "ИНВ-12 · Участок 1 · SN-42", matches: [
    { field: "manufacturer", value: "Siemens" },
    { field: "serialNumber", value: "SN-42" },
    { field: "responsible", value: "Иванов Иван" },
    { field: "workshop", value: "Цех 2" },
  ] }]} />);
  expect(screen.getByText(/Совпадение:/)).toHaveTextContent("Совпадение: Ответственный — Иванов Иван · Цех — Цех 2");
});

it("omits the match line when all values are visible after normalization", () => {
  render(<SearchResults items={[{ ...result("НАСОС ЁЛКА"), subtitle: "Серия  42", matches: [
    { field: "model", value: "елка" }, { field: "serialNumber", value: "Серия 42" },
  ] }]} />);
  expect(screen.queryByText(/Совпадение:/)).not.toBeInTheDocument();
});

it("deduplicates hidden values and supports responses without match metadata", () => {
  render(<SearchResults items={[{ ...result("Насос"), matches: [
    { field: "manufacturer", value: "Siemens" }, { field: "model", value: "SIEMENS" },
  ] }, { ...result("Куртка"), entityId: 2 }]} />);
  expect(screen.getByText(/Совпадение:/)).toHaveTextContent("Совпадение: Производитель — Siemens");
  expect(screen.getAllByText(/Совпадение:/)).toHaveLength(1);
});

it("bolds literal fragments including repeated matches and keeps the original case", () => {
  render(<SearchResults query="чер" items={[{ ...result("Станок"), matches: [
    { field: "responsible", value: "Червенко Чернов" },
  ] }]} />);
  expect(screen.getAllByText(/^[Чч]ер$/).every((part) => part.tagName === "STRONG")).toBe(true);
  expect(screen.getAllByText(/^[Чч]ер$/)).toHaveLength(2);
  expect(screen.queryByText(/Похоже на:/)).not.toBeInTheDocument();
});

it("uses the fuzzy label when the returned field has no literal occurrence", () => {
  render(<SearchResults query="червнко" items={[{ ...result("Станок"), matches: [
    { field: "responsible", value: "Червенко Александр" },
  ] }]} />);
  expect(screen.getByText(/Похоже на:/)).toHaveTextContent("Похоже на: Ответственный — Червенко Александр");
  expect(screen.queryByText(/Совпадение:/)).not.toBeInTheDocument();
});

it.each([
  ["елка  цех", "Ёлка   Цех"],
  ["a+b", "A+B"],
])("highlights normalized literal query %s without treating punctuation as a regex", (query, value) => {
  render(<SearchResults query={query} items={[{ ...result("Станок"), matches: [{ field: "model", value }] }]} />);
  expect(screen.getByText(value.replace(/\s+/g, " ")).tagName).toBe("STRONG");
});
