import {
  render,
  position,
  distribution,
  secondLocation,
} from "./stock-page-test-context";
import { StockDistributionModal } from "./StockDistributionModal";
import { warehouseStockApi } from "../../shared/api/warehouse-stock-api";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ApiRequestError } from "../../shared/api/api-error";
it("opens the bottom action and consolidates free stock and reserve while excluding the destination", async () => {
  const onChanged = vi.fn();
  render(
    <StockDistributionModal
      position={position}
      canTransfer
      onClose={vi.fn()}
      onChanged={onChanged}
    />,
  );
  const open = await screen.findByRole("button", { name: "Переместить всё" });
  await waitFor(() => expect(open).toBeEnabled());
  fireEvent.click(open);
  const sources = screen.getByRole("region", {
    name: "Откуда перемещается товар",
  });
  expect(within(sources).getAllByRole("row")).toHaveLength(4);
  expect(within(sources).getByText("8,001 шт")).toBeVisible();
  expect(
    within(sources).getByText("Резерв · PROJECT-7 · Проект 7"),
  ).toBeVisible();
  const select = screen.getByRole("combobox", { name: "Место назначения" });
  await waitFor(() => expect(select).not.toBeDisabled());
  fireEvent.click(select);
  fireEvent.click(
    await screen.findByRole("option", { name: secondLocation.name }),
  );
  expect(within(sources).getAllByRole("row")).toHaveLength(3);
  expect(
    within(sources).queryByText(secondLocation.name),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Переместить всё" }));
  await waitFor(() =>
    expect(warehouseStockApi.consolidate).toHaveBeenCalledOnce(),
  );
  expect(warehouseStockApi.consolidate).toHaveBeenCalledWith(
    expect.objectContaining({
      itemId: position.item.id,
      fromWarehouseId: position.warehouse.id,
      toLocationId: secondLocation.id,
      moves: [
        {
          fromLocationId: distribution.locations[0].location.id,
          quantity: "8.001",
        },
        {
          fromLocationId: distribution.locations[0].location.id,
          quantity: "2",
          projectId: "7",
        },
      ],
    }),
  );
  await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
});

it.each([
  [409, "WAREHOUSE_TRANSFER_RESERVED_STOCK", true],
  [401, "UNAUTHORIZED", false],
  [403, "FORBIDDEN", false],
  [409, "WAREHOUSE_TRANSFER_REQUEST_CONFLICT", false],
])(
  "handles a retry after an uncertain response (%s, %s)",
  async (status, code, unlocks) => {
    vi.mocked(warehouseStockApi.consolidate)
      .mockRejectedValueOnce(new Error("Ответ потерян"))
      .mockRejectedValueOnce(
        new ApiRequestError("Повтор отклонён", status, code),
      );
    render(
      <StockDistributionModal
        position={position}
        canTransfer
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
    const open = await screen.findByRole("button", { name: "Переместить всё" });
    await waitFor(() => expect(open).toBeEnabled());
    fireEvent.click(open);
    const select = screen.getByRole("combobox", { name: "Место назначения" });
    await waitFor(() => expect(select).not.toBeDisabled());
    fireEvent.click(select);
    fireEvent.click(
      await screen.findByRole("option", { name: secondLocation.name }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Переместить всё" }));
    const retry = await screen.findByRole("button", {
      name: "Повторить перемещение",
    });
    expect(select).toBeDisabled();
    fireEvent.click(retry);
    expect(await screen.findByText("Повтор отклонён")).toBeVisible();
    expect(warehouseStockApi.consolidate).toHaveBeenCalledTimes(2);
    expect(vi.mocked(warehouseStockApi.consolidate).mock.calls[1][0]).toEqual(
      vi.mocked(warehouseStockApi.consolidate).mock.calls[0][0],
    );
    if (unlocks) {
      expect(select).toBeEnabled();
      expect(screen.getByRole("button", { name: "Отмена" })).toBeEnabled();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Закрыть" })).toBeEnabled(),
      );
      vi.mocked(warehouseStockApi.consolidate).mockRejectedValueOnce(
        new ApiRequestError(
          "Нет остатка",
          409,
          "WAREHOUSE_TRANSFER_RESERVED_STOCK",
        ),
      );
      fireEvent.click(screen.getByRole("button", { name: "Переместить всё" }));
      await waitFor(() =>
        expect(warehouseStockApi.consolidate).toHaveBeenCalledTimes(3),
      );
      expect(
        vi.mocked(warehouseStockApi.consolidate).mock.calls[2][0].requestKey,
      ).not.toBe(
        vi.mocked(warehouseStockApi.consolidate).mock.calls[0][0].requestKey,
      );
    } else {
      expect(select).toBeDisabled();
      expect(screen.getByRole("button", { name: "Отмена" })).toBeDisabled();
    }
  },
);
