import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SearchSelect } from "./SearchSelect";
import { useState } from "react";
afterEach(cleanup);

it("lets Escape reach the parent when no popup is visible and consumes it for an empty-state popup", () => {
  const parentKeyDown = vi.fn();
  const props = {
    label: "Страна", value: null, onChange: vi.fn(),
    options: [{ id: 1, name: "Россия" }], minQueryLength: 2,
  };
  const view = render(<div onKeyDown={parentKeyDown}><SearchSelect {...props} /></div>);
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  expect(fireEvent.keyDown(input, { key: "Escape" })).toBe(true);
  expect(parentKeyDown).toHaveBeenCalledTimes(1);
  fireEvent.change(input, { target: { value: "Нет" } });
  expect(fireEvent.keyDown(input, { key: "Escape" })).toBe(true);
  expect(parentKeyDown).toHaveBeenCalledTimes(2);
  view.rerender(<div onKeyDown={parentKeyDown}><SearchSelect {...props} emptyMessage="Нет совпадений" /></div>);
  expect(screen.getByRole("status")).toBeInTheDocument();
  expect(fireEvent.keyDown(input, { key: "Escape" })).toBe(false);
  expect(parentKeyDown).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  fireEvent.keyDown(input, { key: "Escape" });
  expect(parentKeyDown).toHaveBeenCalledTimes(3);
});

it("exposes listbox ARIA references only while the listbox exists", () => {
  const props = {
    label: "Страна", value: null, onChange: vi.fn(),
    options: [{ id: 1, name: "Россия" }], minQueryLength: 2,
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
  expect(input).toHaveAttribute("aria-controls", screen.getByRole("listbox").id);
  expect(document.getElementById(input.getAttribute("aria-activedescendant")!)).toHaveRole("option");
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

it("keeps suggestions outside clipping containers and repositions on scroll", () => {
  const view = render(<div style={{ overflow: "hidden" }} data-admin-modal-id="norm-modal">
    <SearchSelect label="Item" options={[{ id: 1, name: "Item" }]} value={null} onChange={vi.fn()} />
  </div>);
  const input = screen.getByRole("combobox");
  const rect = vi.spyOn(input, "getBoundingClientRect").mockReturnValue({
    left: 40, right: 340, top: window.innerHeight - 90, bottom: window.innerHeight - 50,
    width: 300, height: 40, x: 40, y: 0, toJSON: () => ({}),
  });
  fireEvent.focus(input);
  const menu = screen.getByRole("listbox");
  expect(menu.parentElement).toBe(document.body);
  expect(view.container.contains(menu)).toBe(false);
  expect(menu).toHaveAttribute("data-admin-modal-owner", "norm-modal");
  expect(menu).toHaveStyle({ position: "fixed", bottom: "96px", width: "300px" });
  rect.mockReturnValue({ left: 40, right: 340, top: 50, bottom: 90, width: 300, height: 40, x: 40, y: 50, toJSON: () => ({}) });
  fireEvent.scroll(window);
  expect(menu).toHaveStyle({ top: "96px", bottom: "auto" });
  rect.mockRestore();
});

it("consumes Escape while suggestions are open and preserves pointer selection", () => {
  const parentKeyDown = vi.fn();
  const change = vi.fn();
  render(<div onKeyDown={parentKeyDown}>
    <SearchSelect label="Item" options={[{ id: 1, name: "Item" }]} value={null} onChange={change} />
  </div>);
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
const options = [{ id: 15, name: "Первый" }, { id: 20, name: "Второй" }];

it("stops filtering a large catalog as soon as eight results are available", () => {
  const filterOption = vi.fn(() => true);
  render(<SearchSelect label="Каталог" value={null} onChange={vi.fn()} filterOption={filterOption} maxResults={8}
    options={Array.from({ length: 100000 }, (_, id) => ({ id, name: `Модель ${id}` }))} />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "модель" } });
  expect(filterOption).toHaveBeenCalledTimes(8);
  expect(screen.getAllByRole("option")).toHaveLength(8);
});

it("keeps uncapped filtering complete when maxResults is null", () => {
  render(<SearchSelect label="Каталог" value={null} onChange={vi.fn()} maxResults={null}
    options={Array.from({ length: 12 }, (_, id) => ({ id, name: `Модель ${id}` }))} />);
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "модель" } });
  expect(screen.getAllByRole("option")).toHaveLength(12);
});

it("preserves typed text when editing a selected option and allows another selection", () => {
  function Controlled() {
    const [value, setValue] = useState<number | null>(15);
    return <SearchSelect label="Вариант" options={options} value={value} onChange={setValue} />;
  }
  render(<Controlled />);
  const input = screen.getByRole("combobox");
  expect(input).toHaveValue("Первый");
  fireEvent.change(input, { target: { value: "В" } });
  expect(input).toHaveValue("В");
  fireEvent.change(input, { target: { value: "Втор" } });
  expect(input).toHaveValue("Втор");
  fireEvent.keyDown(input, { key: "Enter" });
  expect(input).toHaveValue("Второй");
});

it("synchronizes external selection, clearing and option renaming", () => {
  const props = { label: "Вариант", options, onChange: vi.fn() };
  const view = render(<SearchSelect {...props} value={15} />);
  const input = screen.getByRole("combobox");
  view.rerender(<SearchSelect {...props} value={20} />);
  expect(input).toHaveValue("Второй");
  view.rerender(<SearchSelect {...props} value={20} options={[{ id: 20, name: "Новое имя" }]} />);
  expect(input).toHaveValue("Новое имя");
  view.rerender(<SearchSelect {...props} value={null} />);
  expect(input).toHaveValue("");
});
it("shows all options by default and preserves position substring matching", () => {
  const change = vi.fn();
  render(
    <SearchSelect
      label="Сотрудник"
      value={null}
      onChange={change}
      options={Array.from({ length: 12 }, (_, i) => ({
        id: i + 1,
        name: "Иван " + i,
        position: "Инженер",
      }))}
    />,
  );
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  expect(screen.getAllByRole("option")).toHaveLength(12);
  fireEvent.change(input, { target: { value: "инженер" } });
  expect(screen.getAllByRole("option")).toHaveLength(12);
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(change).toHaveBeenLastCalledWith(2);
});
