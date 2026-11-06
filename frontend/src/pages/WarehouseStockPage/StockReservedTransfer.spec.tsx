import {
  render,
  distribution,
  secondLocation,
  position,
} from "./stock-page-test-context";
import { StockDistributionModal } from "./StockDistributionModal";
import { warehouseStockApi } from "../../shared/api/warehouse-stock-api";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";

it("shows free stock and each project reserve separately and transfers only the selected reserve", async () => {
  vi.mocked(warehouseStockApi.distribution).mockResolvedValue({
    ...distribution,
    locations: [
      {
        ...distribution.locations[0],
        reserved: "3",
        available: "7.001",
        reservations: [
          ...distribution.locations[0].reservations,
          {
            projectId: "8",
            projectNumber: "PROJECT-8",
            projectName: null,
            quantity: "1",
          },
        ],
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
  const reserve = await screen.findByText("Резерв · PROJECT-7 · Проект 7");
  expect(screen.getByText("Свободно")).toBeVisible();
  expect(screen.getByText("7,001 шт")).toBeVisible();
  expect(screen.getByText("Резерв · PROJECT-8")).toBeVisible();
  fireEvent.click(
    within(reserve.closest("tr")!).getByRole("button", { name: "Переместить" }),
  );
  const destination = screen.getByRole("combobox", {
    name: "Место назначения",
  });
  await waitFor(() => expect(destination).not.toBeDisabled());
  fireEvent.click(destination);
  fireEvent.click(
    await screen.findByRole("option", { name: secondLocation.name }),
  );
  fireEvent.change(screen.getByLabelText("Количество"), {
    target: { value: "3" },
  });
  expect(screen.getByRole("button", { name: "Переместить" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Количество"), {
    target: { value: "1.125" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Переместить" }));
  await waitFor(() =>
    expect(warehouseStockApi.transfer).toHaveBeenCalledOnce(),
  );
  expect(warehouseStockApi.transfer).toHaveBeenCalledWith(
    expect.objectContaining({
      moveReservation: true,
      projectId: "7",
      quantity: "1.125",
      fromLocationId: distribution.locations[0].location.id,
      toLocationId: secondLocation.id,
    }),
  );
});
