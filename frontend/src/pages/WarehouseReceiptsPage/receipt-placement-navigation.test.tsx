import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Controlled, receipt, twoLines } from "./receipt-placement-test-utils";

it("allows skipping unfinished lines, shows them in the summary and returns to one", () => {
  render(<Controlled />);
  expect(
    screen.getByRole("heading", { name: "Подшипник" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Далее" }));
  expect(screen.getByRole("heading", { name: "Кабель" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Итоги →" }));
  expect(
    screen.getByRole("heading", { name: "Осталось разместить" }),
  ).toBeInTheDocument();
  expect(screen.queryByText(/Незавершённых позиций:/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Кабель ·/ }));
  expect(screen.getByRole("heading", { name: "Кабель" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Назад" }));
  expect(
    screen.getByRole("heading", { name: "Подшипник" }),
  ).toBeInTheDocument();
});

it("exits from the final completed line without showing a completion screen", () => {
  const onExit = vi.fn();
  render(
    <Controlled
      onExit={onExit}
      value={{
        ...twoLines,
        lines: twoLines.lines.map((line) => ({
          ...line,
          placed: "10",
          remaining: "0",
        })),
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Далее" }));
  expect(
    screen.queryByRole("button", { name: "Итоги →" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Выйти" }));
  expect(onExit).toHaveBeenCalledOnce();
  expect(
    screen.queryByRole("heading", { name: "Размещение завершено" }),
  ).not.toBeInTheDocument();
});

it("keeps the selected line when refreshed quantities arrive", () => {
  const { rerender } = render(<Controlled />);
  fireEvent.click(screen.getByRole("button", { name: "Далее" }));
  rerender(
    <Controlled
      value={{
        ...twoLines,
        lines: [
          twoLines.lines[0],
          { ...twoLines.lines[1], placed: "5", remaining: "5" },
        ],
      }}
    />,
  );
  expect(screen.getByRole("heading", { name: "Кабель" })).toBeInTheDocument();
});

it("exits from an empty receipt without a broken back action", () => {
  const onExit = vi.fn();
  render(<Controlled onExit={onExit} value={{ ...receipt, lines: [] }} />);
  fireEvent.click(screen.getByRole("button", { name: "Выйти" }));
  expect(onExit).toHaveBeenCalledOnce();
});

it("exits from the unfinished summary instead of going back to the last line", () => {
  const onExit = vi.fn();
  render(<Controlled onExit={onExit} />);
  fireEvent.click(screen.getByRole("button", { name: "Далее" }));
  fireEvent.click(screen.getByRole("button", { name: "Итоги →" }));
  expect(
    screen.queryByRole("button", { name: "Назад" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Вернуться к незавершённым" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Выйти" }));
  expect(onExit).toHaveBeenCalledOnce();
});

it("starts at the first unfinished line without a saved position", () => {
  render(
    <Controlled
      value={{
        ...twoLines,
        lines: [
          { ...twoLines.lines[0], placed: "10", remaining: "0" },
          twoLines.lines[1],
        ],
      }}
    />,
  );
  expect(screen.getByRole("heading", { name: "Кабель" })).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Подшипник" }),
  ).not.toBeInTheDocument();
});
