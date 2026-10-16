import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TemplatesPanel } from "./TemplatesPanel";

afterEach(cleanup);
const props = () => ({ isLoading: false, onArchive: vi.fn(), onCopy: vi.fn(), onCreate: vi.fn(), onSearch: vi.fn(), search: "", setSearch: vi.fn(), setState: vi.fn(), state: "ACTIVE", templates: [] });

it("keeps filters in a modal and does not apply them when cancelled", () => {
  const p = props();
  render(<TemplatesPanel {...p} />);
  expect(screen.queryByRole("button", { name: "Найти" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Фильтры шаблонов" }));
  expect(screen.getByRole("dialog", { name: "Фильтры шаблонов" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Применить" }));
  expect(p.onSearch).toHaveBeenCalledWith({ state: "ACTIVE" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  p.onSearch.mockClear();
  fireEvent.click(screen.getByRole("button", { name: "Фильтры шаблонов" }));
  fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
  expect(p.onSearch).not.toHaveBeenCalled();
});

it("searches after typing without the Find button", async () => {
  const p = props();
  const view = render(<TemplatesPanel {...p} />);
  view.rerender(<TemplatesPanel {...p} search="Проверка" />);
  await waitFor(() => expect(p.onSearch).toHaveBeenCalledWith({ search: "Проверка" }));
});
