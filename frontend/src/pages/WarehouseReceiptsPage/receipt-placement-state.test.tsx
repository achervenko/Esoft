import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Controlled, receipt, twoLines } from "./receipt-placement-test-utils";

it("locks navigation during a placement request", () => {
  render(<Controlled />);
  fireEvent.click(screen.getByRole("button", { name: "Тест размещения" }));
  expect(screen.getByRole("button", { name: "Далее" })).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: "Позиции" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Позиция 2: Кабель" }),
  ).toBeDisabled();
});

it("shows mapping instead of placement for an unknown item", () => {
  const onMap = vi.fn();
  render(
    <Controlled
      value={{ ...receipt, lines: [{ ...receipt.lines[0], itemId: null }] }}
      onMap={onMap}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Сопоставить" }));
  expect(onMap).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "Разместить" })).toBeDisabled();
});

it("does not call a fully placed line complete while a request still needs recovery", () => {
  sessionStorage.setItem(
    `warehouse.receipts.pending:actor:place:${receipt.id}:${receipt.lines[0].id}`,
    JSON.stringify({
      requestKey: "pending",
      body: { storageLocationId: "4", quantity: "6" },
    }),
  );
  render(
    <Controlled
      value={{
        ...receipt,
        lines: [{ ...receipt.lines[0], placed: "10", remaining: "0" }],
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Итоги →" }));
  expect(
    screen.getByRole("heading", { name: "Осталось разместить" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /Подшипник ·/ }),
  ).toBeInTheDocument();
});

it("keeps services unresolved when all goods are placed and explains them in the summary", () => {
  render(
    <Controlled
      value={{
        ...twoLines,
        status: "PLACING",
        lines: [
          { ...twoLines.lines[0], placed: "10", remaining: "0" },
          { ...twoLines.lines[1], name: "Доставка", sourceType: "SERVICE" },
        ],
      }}
    />,
  );
  expect(screen.getByRole("heading", { name: "Доставка" })).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Позиция 1: Подшипник" }),
  ).toHaveAttribute("data-complete", "true");
  expect(
    screen.getByRole("button", { name: "Позиция 2: Доставка" }),
  ).toHaveAttribute("data-complete", "false");
  expect(
    screen.queryByRole("button", { name: "Тест размещения" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Итоги →" }));
  expect(
    screen.getByRole("heading", { name: "Требуется внимание" }),
  ).toBeVisible();
  expect(screen.queryByText("Размещение завершено")).not.toBeInTheDocument();
  expect(screen.getByText(/Приход остаётся незавершённым/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /Доставка · Тип/ }));
  expect(screen.getByRole("heading", { name: "Доставка" })).toBeVisible();
});

it("offers exit directly when opening an already completed receipt", () => {
  const onExit = vi.fn();
  render(
    <Controlled
      onExit={onExit}
      value={{
        ...receipt,
        status: "PLACED",
        lines: [{ ...receipt.lines[0], placed: "10", remaining: "0" }],
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Выйти" }));
  expect(onExit).toHaveBeenCalledOnce();
  expect(
    screen.queryByRole("heading", { name: "Размещение завершено" }),
  ).not.toBeInTheDocument();
});
