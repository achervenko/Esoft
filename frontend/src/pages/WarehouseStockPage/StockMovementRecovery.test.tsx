import {
  render,
  distribution,
  position,
  secondLocation,
} from "./stock-page-test-context";
import { StockDistributionModal } from "./StockDistributionModal";
import { WarehouseStockPage } from "./WarehouseStockPage";
import { warehouseStockApi } from "../../shared/api/warehouse-stock-api";
import { readPendingStockMovement } from "./pending-stock-movement";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
it.each(["transfer", "consolidation"] as const)(
  "restores %s after reload even when source stock disappeared and never applies twice",
  async (kind) => {
    const api =
      kind === "transfer"
        ? warehouseStockApi.transfer
        : warehouseStockApi.consolidate;
    const applied = new Set<string>();
    vi.mocked(api).mockImplementation(async (input) => {
      if (!applied.has(input.requestKey)) {
        applied.add(input.requestKey);
        throw new Error("Ответ потерян");
      }
      return { id: "1", ids: ["1"] };
    });
    render(
      <StockDistributionModal
        position={position}
        canTransfer
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
    if (kind === "transfer") {
      const buttons = await screen.findAllByRole("button", {
        name: "Переместить",
      });
      fireEvent.click(buttons[0]);
    } else
      fireEvent.click(
        await screen.findByRole("button", {
          name: "Переместить всё",
        }),
      );
    const destination = screen.getByRole("combobox", {
      name: "Место назначения",
    });
    await waitFor(() => expect(destination).toBeEnabled());
    fireEvent.click(destination);
    fireEvent.click(
      await screen.findByRole("option", { name: secondLocation.name }),
    );
    if (kind === "transfer")
      fireEvent.change(screen.getByLabelText("Количество"), {
        target: { value: "2.125" },
      });
    fireEvent.click(
      screen.getByRole("button", {
        name: kind === "transfer" ? "Переместить" : "Переместить всё",
      }),
    );
    await screen.findByText("Ответ потерян");
    const first = readPendingStockMovement()!;
    expect(first.input).toEqual(vi.mocked(api).mock.calls[0][0]);
    cleanup();
    vi.mocked(warehouseStockApi.distribution).mockResolvedValue({
      ...distribution,
      totalQuantity: "0",
      locations: [],
    });
    vi.mocked(warehouseStockApi.list).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 50,
    });
    render(
      <WarehouseStockPage
        userPermissions={["warehouse.stock.read", "warehouse.transfers.manage"]}
      />,
    );
    const retry = await screen.findByRole("button", {
      name: "Повторить перемещение",
    });
    expect(screen.getByRole("button", { name: "Отмена" })).toBeDisabled();
    expect(
      screen.getByRole("combobox", { name: "Место назначения" }),
    ).toBeDisabled();
    vi.mocked(warehouseStockApi.currentUserId).mockResolvedValueOnce(
      "another-user",
    );
    fireEvent.click(retry);
    await screen.findByText(
      "Сначала подтвердите предыдущее перемещение под тем же пользователем.",
    );
    expect(api).toHaveBeenCalledTimes(1);
    fireEvent.click(retry);
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api).mock.calls[1][0]).toEqual(first.input);
    expect(applied.size).toBe(1);
    await waitFor(() => expect(readPendingStockMovement()).toBeNull());
  },
);
