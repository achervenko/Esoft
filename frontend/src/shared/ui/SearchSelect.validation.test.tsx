import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SearchSelect } from "./SearchSelect";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("shows no-match errors only once the minimum query length is reached", () => {
  render(
    <SearchSelect
      label="СИЗ"
      value={null}
      onChange={vi.fn()}
      options={[{ id: 1, name: "Каска" }]}
      minQueryLength={3}
      noMatchError="Ничего не найдено"
    />,
  );
  const input = screen.getByRole("combobox");
  fireEvent.change(input, { target: { value: "Бо" } });
  expect(input).not.toHaveAttribute("aria-invalid");
  expect(screen.queryByText("Ничего не найдено")).toBeNull();
  fireEvent.change(input, { target: { value: "Бот" } });
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByText("Ничего не найдено")).toBeInTheDocument();
  fireEvent.change(input, { target: { value: "Бо" } });
  expect(input).not.toHaveAttribute("aria-invalid");
  expect(screen.queryByText("Ничего не найдено")).toBeNull();
});

it("reports unmatched manual input separately and clears the error when matches return", () => {
  const change = vi.fn();
  render(
    <SearchSelect
      label="СИЗ"
      value={null}
      onChange={change}
      options={[{ id: 1, name: "001 — Ботинки" }]}
      noMatchError="Такой СИЗ не найден"
    />,
  );
  const input = screen.getByRole("combobox");
  expect(input).not.toHaveAttribute("aria-invalid");
  fireEvent.change(input, { target: { value: "Неизвестный СИЗ" } });
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByText("Такой СИЗ не найден")).toBeInTheDocument();
  expect(change).toHaveBeenLastCalledWith(null);
  fireEvent.change(input, { target: { value: "001" } });
  expect(input).not.toHaveAttribute("aria-invalid");
  expect(screen.queryByText("Такой СИЗ не найден")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("option"));
  expect(change).toHaveBeenLastCalledWith(1);
});
