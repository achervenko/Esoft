import {
  render,
  distribution,
  secondLocation,
} from "./stock-page-test-context";
import { StockTransferForm } from "./StockTransferForm";
import { warehouseStockApi } from "../../shared/api/warehouse-stock-api";
import { StockDistributionModal } from "./StockDistributionModal";
import { position } from "./stock-page-test-context";
import {
  fireEvent,
  screen,
  waitFor,
  within,
  act,
} from "@testing-library/react";
import { expect, it, vi } from "vitest";
it("shows the source warehouse immediately while warehouse choices are still loading", () => {
  vi.mocked(warehouseStockApi.warehouses).mockImplementation(
    () => new Promise(() => {}),
  );
  render(
    <StockTransferForm
      data={distribution}
      source={distribution.locations[0]}
      onClose={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  const warehouse = screen.getByRole("combobox", { name: "Склад назначения" });
  expect(warehouse).toHaveValue(distribution.warehouse.name);
  expect(warehouse).toBeDisabled();
});
it("blocks amounts above free stock and reuses the request key after a network failure", async () => {
  const saved = vi.fn();
  render(
    <StockTransferForm
      data={distribution}
      source={distribution.locations[0]}
      onClose={vi.fn()}
      onSaved={saved}
    />,
  );
  const destination = screen.getByRole("combobox", {
    name: "Место назначения",
  });
  expect(screen.getByLabelText("Склад отправления")).toHaveAttribute(
    "readonly",
  );
  expect(screen.getByLabelText("Место отправления")).toHaveAttribute(
    "readonly",
  );
  expect(screen.queryByLabelText("Комментарий")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Добавить комментарий" }));
  expect(screen.getByLabelText("Комментарий")).toHaveAttribute(
    "maxlength",
    "4000",
  );
  fireEvent.change(screen.getByLabelText("Комментарий"), {
    target: { value: "На новый стеллаж" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Скрыть комментарий" }));
  expect(screen.queryByLabelText("Комментарий")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Изменить комментарий" }));
  expect(screen.getByLabelText("Комментарий")).toHaveValue("На новый стеллаж");
  await waitFor(() => expect(destination).not.toBeDisabled());
  fireEvent.click(destination);
  fireEvent.click(
    await screen.findByRole("option", { name: secondLocation.name }),
  );
  fireEvent.change(screen.getByLabelText("Количество"), {
    target: { value: "9" },
  });
  expect(screen.getByRole("button", { name: "Переместить" })).toBeDisabled();
  expect(
    screen.getByText("Нельзя переместить больше доступного остатка: 8,001 шт."),
  ).toBeTruthy();
  for (const [value, message] of [
    ["-1", "Количество не может быть отрицательным."],
    ["0", "Количество должно быть больше нуля."],
    ["1,0001", "Допустимо не более трёх знаков после запятой."],
    ["abc", "Введите корректное количество."],
  ]) {
    fireEvent.change(screen.getByLabelText("Количество"), {
      target: { value },
    });
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Переместить" })).toBeDisabled();
  }
  fireEvent.change(screen.getByLabelText("Количество"), {
    target: { value: "1,001" },
  });
  vi.mocked(warehouseStockApi.transfer).mockRejectedValueOnce(
    new Error("Нет ответа"),
  );
  const summary = screen.getByRole("region", { name: "Итог перемещения" });
  expect(within(summary).getByText("Останется: 9 шт")).toBeTruthy();
  expect(within(summary).getByText("Добавится: 1,001 шт")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Переместить" }));
  await screen.findByText("Нет ответа");
  const first = vi.mocked(warehouseStockApi.transfer).mock.calls[0][0];
  expect(first.quantity).toBe("1.001");
  expect(first.fromLocationId).toBe(distribution.locations[0].location.id);
  expect(first.toLocationId).toBe(secondLocation.id);
  expect(first.requestKey).toMatch(/^[a-f0-9-]{36}$/);
  fireEvent.click(screen.getByRole("button", { name: "Переместить" }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(vi.mocked(warehouseStockApi.transfer).mock.calls[1][0]).toEqual(first);
});
it("prevents concurrent submits and refreshes distribution and parent after successful movement", async () => {
  const changed = vi.fn();
  render(
    <StockDistributionModal
      position={position}
      canTransfer
      onClose={vi.fn()}
      onChanged={changed}
    />,
  );
  const detail = await screen.findByRole("dialog", {
    name: "Места хранения (Основной склад)",
  });
  const backdrop = detail.parentElement;
  await within(detail).findByText("Угол ангара");
  fireEvent.click(
    within(detail).getAllByRole("button", { name: "Переместить" })[0],
  );
  const destination = await screen.findByRole("combobox", {
    name: "Место назначения",
  });
  expect(screen.getByRole("dialog", { name: "Переместить остаток" })).toBe(
    detail,
  );
  expect(detail.parentElement).toBe(backdrop);
  await waitFor(() => expect(destination).not.toBeDisabled());
  fireEvent.click(destination);
  fireEvent.click(
    await screen.findByRole("option", { name: secondLocation.name }),
  );
  fireEvent.change(screen.getByLabelText("Количество"), {
    target: { value: "1" },
  });
  let done!: (v: { id: string }) => void;
  vi.mocked(warehouseStockApi.transfer).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        done = resolve;
      }),
  );
  const form = screen
    .getByRole("button", { name: "Переместить" })
    .closest("form")!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(warehouseStockApi.transfer).toHaveBeenCalledTimes(1);
  await act(async () => done({ id: "1" }));
  await screen.findByRole("dialog", {
    name: "Места хранения (Основной склад)",
  });
  expect(
    screen.getByRole("dialog", { name: "Места хранения (Основной склад)" }),
  ).toBe(detail);
  expect(detail.parentElement).toBe(backdrop);
  expect(changed).toHaveBeenCalledOnce();
  await waitFor(() =>
    expect(warehouseStockApi.distribution).toHaveBeenCalledTimes(2),
  );
});

it("blocks moving reserved or inactive sources while keeping distribution readable", async () => {
  vi.mocked(warehouseStockApi.distribution).mockResolvedValue({
    ...distribution,
    locations: [
      { ...distribution.locations[0], available: "0" },
      {
        ...distribution.locations[1],
        location: { ...distribution.locations[1].location, isActive: false },
      },
    ],
  });
  render(
    <StockDistributionModal
      position={position}
      canTransfer
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
  const modal = await screen.findByRole("dialog", {
    name: "Места хранения (Основной склад)",
  });
  await within(modal).findByText("Место неактивно");
  for (const button of within(modal).getAllByRole("button", {
    name: "Переместить",
  }))
    expect(button).toBeDisabled();
  expect(within(modal).getByText("10,001 шт")).toBeTruthy();
});
