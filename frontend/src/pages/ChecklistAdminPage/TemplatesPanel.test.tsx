import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TemplatesPanel } from "./TemplatesPanel";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { ChecklistTemplateListItem } from "../../shared/api/checklists";

afterEach(cleanup);
const props = () => ({
  isLoading: false,
  onArchive: vi.fn(),
  onCopy: vi.fn(),
  onCreate: vi.fn(),
  onSearch: vi.fn(),
  search: "",
  setSearch: vi.fn(),
  state: "ACTIVE",
  templates: [],
  sort: { key: "name", direction: "asc" } as const,
  onSortChange: vi.fn(),
});

it("keeps server order on append and forwards every sortable header", () => {
  const p = props();
  const first = {
    id: 1,
    name: "Я",
    state: "ACTIVE",
    questionCount: 3,
  } as ChecklistTemplateListItem;
  const last = {
    id: 2,
    name: "А",
    state: "ACTIVE",
    questionCount: 1,
  } as ChecklistTemplateListItem;
  const view = render(<TemplatesPanel {...p} templates={[first]} />, {
    wrapper: ({ children }) => (
      <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
    ),
  });
  view.rerender(<TemplatesPanel {...p} templates={[first, last]} />);
  expect(screen.getAllByRole("row")[1]).toHaveTextContent("Я");
  for (const [label, key, direction] of [
    ["Шаблон", "name", "desc"],
    ["Статус", "state", "asc"],
    ["Вопросы", "questions", "asc"],
  ]) {
    fireEvent.click(
      screen.getByRole("button", { name: `Сортировать: ${label}` }),
    );
    expect(p.onSortChange).toHaveBeenLastCalledWith({ key, direction });
  }
});

it("applies template filters from the modal", () => {
  const p = props();
  render(<TemplatesPanel {...p} />);
  expect(
    screen.queryByRole("button", { name: "Найти" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Фильтры шаблонов" }));
  expect(
    screen.getByRole("dialog", { name: "Фильтры шаблонов" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Применить" }));
  expect(p.onSearch).toHaveBeenCalledWith({ state: "ACTIVE" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("does not apply template filters when the modal is closed", () => {
  const p = props();
  render(<TemplatesPanel {...p} />);
  fireEvent.click(screen.getByRole("button", { name: "Фильтры шаблонов" }));
  fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
  expect(p.onSearch).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("searches after typing without the Find button", async () => {
  const p = props();
  const view = render(<TemplatesPanel {...p} />);
  view.rerender(<TemplatesPanel {...p} search="Проверка" />);
  await waitFor(() =>
    expect(p.onSearch).toHaveBeenCalledWith({ search: "Проверка" }),
  );
});
