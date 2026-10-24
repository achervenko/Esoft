import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SearchSelect } from "./SearchSelect";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("lets Escape reach the parent when no popup is visible and consumes it for an empty-state popup", () => {
  const parentKeyDown = vi.fn();
  const props = {
    label: "Страна",
    value: null,
    onChange: vi.fn(),
    options: [{ id: 1, name: "Россия" }],
    minQueryLength: 2,
  };
  const view = render(
    <div onKeyDown={parentKeyDown}>
      <SearchSelect {...props} />
    </div>,
  );
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  expect(fireEvent.keyDown(input, { key: "Escape" })).toBe(true);
  expect(parentKeyDown).toHaveBeenCalledTimes(1);
  fireEvent.change(input, { target: { value: "Нет" } });
  expect(fireEvent.keyDown(input, { key: "Escape" })).toBe(true);
  expect(parentKeyDown).toHaveBeenCalledTimes(2);
  view.rerender(
    <div onKeyDown={parentKeyDown}>
      <SearchSelect {...props} emptyMessage="Нет совпадений" />
    </div>,
  );
  expect(screen.getByRole("status")).toBeInTheDocument();
  expect(fireEvent.keyDown(input, { key: "Escape" })).toBe(false);
  expect(parentKeyDown).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  fireEvent.keyDown(input, { key: "Escape" });
  expect(parentKeyDown).toHaveBeenCalledTimes(3);
});

it("exposes listbox ARIA references only while the listbox exists", () => {
  const props = {
    label: "Страна",
    value: null,
    onChange: vi.fn(),
    options: [{ id: 1, name: "Россия" }],
    minQueryLength: 2,
    emptyMessage: "Нет совпадений",
  };
  const view = render(<SearchSelect {...props} />);
  const input = screen.getByRole("combobox");
  const expectCollapsed = () => {
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).not.toHaveAttribute("aria-controls");
    expect(input).not.toHaveAttribute("aria-activedescendant");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  };
  expectCollapsed();
  fireEvent.focus(input);
  expectCollapsed();
  fireEvent.change(input, { target: { value: "Р" } });
  expectCollapsed();
  fireEvent.change(input, { target: { value: "Ро" } });
  expect(input).toHaveAttribute("aria-expanded", "true");
  expect(input).toHaveAttribute(
    "aria-controls",
    screen.getByRole("listbox").id,
  );
  expect(
    document.getElementById(input.getAttribute("aria-activedescendant")!),
  ).toHaveRole("option");
  fireEvent.change(input, { target: { value: "Нет" } });
  expectCollapsed();
  expect(screen.getByRole("status")).toHaveTextContent("Нет совпадений");
  fireEvent.change(input, { target: { value: "Ро" } });
  fireEvent.keyDown(input, { key: "Escape" });
  expectCollapsed();
  fireEvent.focus(input);
  view.rerender(<SearchSelect {...props} disabled />);
  expectCollapsed();
});

it("consumes Escape while suggestions are open and preserves pointer selection", () => {
  const parentKeyDown = vi.fn();
  const change = vi.fn();
  render(
    <div onKeyDown={parentKeyDown}>
      <SearchSelect
        label="Item"
        options={[{ id: 1, name: "Item" }]}
        value={null}
        onChange={change}
      />
    </div>,
  );
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  fireEvent.keyDown(input, { key: "Escape" });
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(parentKeyDown).not.toHaveBeenCalled();
  fireEvent.focus(input);
  fireEvent.mouseDown(screen.getByRole("option"));
  fireEvent.click(screen.getByRole("option"));
  expect(change).toHaveBeenCalledWith(1);
});
