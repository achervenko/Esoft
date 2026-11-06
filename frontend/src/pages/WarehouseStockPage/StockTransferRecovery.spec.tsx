import {
  render,
  distribution,
  secondLocation,
} from "./stock-page-test-context";
import { StockTransferForm } from "./StockTransferForm";
import { warehouseStockApi } from "../../shared/api/warehouse-stock-api";
import { ApiRequestError } from "../../shared/api/api-error";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

async function prepare() {
  const onSaved = vi.fn();
  render(
    <StockTransferForm
      data={distribution}
      source={distribution.locations[0]}
      onClose={vi.fn()}
      onSaved={onSaved}
    />,
  );
  const destination = screen.getByRole("combobox", {
    name: "Место назначения",
  });
  await waitFor(() => expect(destination).not.toBeDisabled());
  fireEvent.click(destination);
  fireEvent.click(
    await screen.findByRole("option", { name: secondLocation.name }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Добавить комментарий" }));
  fireEvent.change(screen.getByLabelText("Комментарий"), {
    target: { value: "Исходный комментарий" },
  });
  fireEvent.change(screen.getByLabelText("Количество"), {
    target: { value: "1.25" },
  });
  return { onSaved, destination };
}

it("keeps the original command locked after a committed transfer loses its response and retries without another debit", async () => {
  const committed = new Map<string, { id: string }>();
  let debited = 0n;
  vi.mocked(warehouseStockApi.transfer).mockImplementation(async (input) => {
    const previous = committed.get(input.requestKey);
    if (previous) return previous;
    committed.set(input.requestKey, { id: "transfer-1" });
    debited += 1250n;
    throw new Error("Ответ потерян после проведения");
  });
  const { onSaved, destination } = await prepare();
  fireEvent.click(screen.getByRole("button", { name: "Переместить" }));
  const retry = await screen.findByRole("button", {
    name: "Повторить перемещение",
  });
  expect(destination).toBeDisabled();
  expect(
    screen.getByRole("combobox", { name: "Склад назначения" }),
  ).toBeDisabled();
  expect(screen.getByLabelText("Количество")).toBeDisabled();
  expect(screen.getByLabelText("Комментарий")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Отмена" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Закрыть" })).toBeDisabled();
  fireEvent.click(retry);
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(warehouseStockApi.transfer).toHaveBeenCalledTimes(2);
  expect(vi.mocked(warehouseStockApi.transfer).mock.calls[1][0]).toEqual(
    vi.mocked(warehouseStockApi.transfer).mock.calls[0][0],
  );
  expect(committed.size).toBe(1);
  expect(debited).toBe(1250n);
});

it.each([
  [409, "WAREHOUSE_TRANSFER_RESERVED_STOCK", true],
  [403, "FORBIDDEN", false],
])(
  "handles a definitive business conflict separately from an uncertain permission rejection (%s)",
  async (status, code, unlocks) => {
    vi.mocked(warehouseStockApi.transfer)
      .mockRejectedValueOnce(new Error("Нет ответа"))
      .mockRejectedValueOnce(
        new ApiRequestError("Повтор отклонён", status, code),
      );
    const { destination } = await prepare();
    fireEvent.click(screen.getByRole("button", { name: "Переместить" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Повторить перемещение" }),
    );
    expect(await screen.findByText("Повтор отклонён")).toBeVisible();
    if (unlocks) {
      expect(destination).toBeEnabled();
      expect(screen.getByRole("button", { name: "Отмена" })).toBeEnabled();
    } else expect(destination).toBeDisabled();
  },
);
