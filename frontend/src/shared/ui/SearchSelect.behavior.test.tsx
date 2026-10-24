import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SearchSelect } from "./SearchSelect";
import { useState } from "react";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const options = [
  { id: 15, name: "Первый" },
  { id: 20, name: "Второй" },
];

it("stops filtering a large catalog as soon as eight results are available", () => {
  const filterOption = vi.fn(() => true);
  render(
    <SearchSelect
      label="Каталог"
      value={null}
      onChange={vi.fn()}
      filterOption={filterOption}
      maxResults={8}
      options={Array.from({ length: 100000 }, (_, id) => ({
        id,
        name: `Модель ${id}`,
      }))}
    />,
  );
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "модель" },
  });
  expect(filterOption).toHaveBeenCalledTimes(8);
  expect(screen.getAllByRole("option")).toHaveLength(8);
});

it("keeps uncapped filtering complete when maxResults is null", () => {
  render(
    <SearchSelect
      label="Каталог"
      value={null}
      onChange={vi.fn()}
      maxResults={null}
      options={Array.from({ length: 12 }, (_, id) => ({
        id,
        name: `Модель ${id}`,
      }))}
    />,
  );
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "модель" },
  });
  expect(screen.getAllByRole("option")).toHaveLength(12);
});

it("preserves typed text when editing a selected option and allows another selection", () => {
  function Controlled() {
    const [value, setValue] = useState<number | null>(15);
    return (
      <SearchSelect
        label="Вариант"
        options={options}
        value={value}
        onChange={setValue}
      />
    );
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
  view.rerender(
    <SearchSelect
      {...props}
      value={20}
      options={[{ id: 20, name: "Новое имя" }]}
    />,
  );
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
