import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SearchToolbar } from "./SearchToolbar";
afterEach(cleanup);
it("shares search, clearing, filter count and plain Add text", () => {
  const change = vi.fn(),
    open = vi.fn(),
    create = vi.fn();
  render(
    <SearchToolbar
      label="Поиск"
      value="болт"
      onChange={change}
      onCreate={create}
      createAriaLabel="Добавить позицию"
      filters={{
        label: "Фильтры",
        count: 2,
        expanded: true,
        controls: "filters-dialog",
        onOpen: open,
      }}
    />,
  );
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "гайка" },
  });
  expect(change).toHaveBeenLastCalledWith("гайка");
  fireEvent.click(screen.getByRole("button", { name: "Очистить поиск" }));
  expect(change).toHaveBeenLastCalledWith("");
  const filter = screen.getByRole("button", { name: "Фильтры" });
  expect(filter).toHaveAttribute("aria-expanded", "true");
  expect(filter).toHaveAttribute("aria-controls", "filters-dialog");
  expect(filter).toHaveTextContent("2");
  fireEvent.click(filter);
  expect(open).toHaveBeenCalledOnce();
  const add = screen.getByRole("button", { name: "Добавить позицию" });
  expect(add).toHaveTextContent(/^Добавить$/);
  fireEvent.click(add);
  expect(create).toHaveBeenCalledOnce();
});
it("preserves immediate clear and Enter handlers and input constraints", () => {
  const change = vi.fn(),
    clear = vi.fn(),
    key = vi.fn();
  render(
    <SearchToolbar
      label="Поиск"
      value="запрос"
      onChange={change}
      onClear={clear}
      inputProps={{ autoFocus: true, maxLength: 200, onKeyDown: key }}
    />,
  );
  const input = screen.getByRole("searchbox");
  expect(input).toHaveFocus();
  expect(input).toHaveAttribute("maxlength", "200");
  fireEvent.keyDown(input, { key: "Enter" });
  expect(key).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Очистить поиск" }));
  expect(clear).toHaveBeenCalledOnce();
  expect(change).not.toHaveBeenCalled();
});
it("hides optional actions and zero counts, and disables creation", () => {
  const { rerender } = render(
    <SearchToolbar label="Поиск" value="" onChange={vi.fn()} />,
  );
  expect(screen.queryByRole("button")).toBeNull();
  rerender(
    <SearchToolbar
      label="Поиск"
      value=""
      onChange={vi.fn()}
      onCreate={vi.fn()}
      createDisabled
      filters={{ label: "Фильтры", count: 0, onOpen: vi.fn() }}
    />,
  );
  expect(screen.getByRole("button", { name: "Добавить" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Фильтры" })).toHaveTextContent("");
  expect(screen.queryByText("0")).toBeNull();
});
