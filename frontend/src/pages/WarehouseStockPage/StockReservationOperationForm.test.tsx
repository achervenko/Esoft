import { render, distribution, position } from "./stock-page-test-context";
import { StockDistributionModal } from "./StockDistributionModal";
import { StockReservationOperationForm } from "./StockReservationOperationForm";
import { warehouseStockApi } from "../../shared/api/warehouse-stock-api";
import { fireEvent, screen, waitFor, cleanup } from "@testing-library/react";
import { expect, it, vi } from "vitest";
const source = {
  balance: distribution.locations[0],
  reservation: {
    ...distribution.locations[0].reservations[0],
    id: "77",
    borrowedQuantity: "0",
    movableQuantity: "2",
  },
};
it("only administrator sees reservation management and shortage is visible", async () => {
  const data = {
    ...distribution,
    locations: [
      { ...source.balance, shortage: "3", reservations: [source.reservation] },
    ],
  };
  vi.mocked(warehouseStockApi.distribution).mockResolvedValue(data);
  const view = render(
    <StockDistributionModal
      position={position}
      canTransfer
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
  await screen.findByText("Не хватает: 3 шт");
  expect(
    screen.queryByRole("button", { name: "Управлять резервом" }),
  ).toBeNull();
  view.unmount();
  render(
    <StockDistributionModal
      position={position}
      canTransfer
      canAdjust
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Управлять резервом" }),
  );
  expect(screen.getByRole("dialog", { name: "Резерв проекта" })).toBeVisible();
});
it("requires comment, permits no file and retries the exact borrow after remount", async () => {
  vi.mocked(warehouseStockApi.reservationOperation)
    .mockRejectedValueOnce(new Error("Ответ потерян"))
    .mockResolvedValueOnce({});
  const props = {
    data: distribution,
    source,
    onSaved: vi.fn(),
    onClose: vi.fn(),
    onSavingChange: vi.fn(),
  };
  render(<StockReservationOperationForm {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Действие" }));
  fireEvent.click(
    await screen.findByRole("option", { name: "Заимствовать из резерва" }),
  );
  fireEvent.change(screen.getByLabelText(/Количество/), {
    target: { value: "1" },
  });
  expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Комментарий"), {
    target: { value: "Собственные нужды" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await screen.findByText("Ответ потерян");
  const input = vi.mocked(warehouseStockApi.reservationOperation).mock
    .calls[0][1];
  expect(input).toMatchObject({
    action: "BORROW",
    quantity: "1",
    attachments: [],
  });
  cleanup();
  render(<StockReservationOperationForm {...props} />);
  expect(screen.getByLabelText(/Количество/)).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Повторить операцию" }));
  await waitFor(() =>
    expect(warehouseStockApi.reservationOperation).toHaveBeenCalledTimes(2),
  );
  expect(
    vi.mocked(warehouseStockApi.reservationOperation).mock.calls[1][1],
  ).toEqual(input);
});

it("hides empty unreserved locations for admin but keeps an unfulfilled reserve", async () => {
  const empty = {
    ...distribution.locations[1],
    quantity: "0",
    available: "0",
    reserved: "0",
    reservations: [],
  };
  const unmet = {
    ...source.balance,
    quantity: "0",
    available: "0",
    reserved: "0",
    shortage: "2",
    reservations: [
      { ...source.reservation, borrowedQuantity: "2", movableQuantity: "0" },
    ],
  };
  vi.mocked(warehouseStockApi.distribution).mockResolvedValue({
    ...distribution,
    locations: [empty, unmet],
  });
  render(
    <StockDistributionModal
      position={position}
      canTransfer
      canAdjust
      onClose={vi.fn()}
      onChanged={vi.fn()}
    />,
  );
  await screen.findByText("Не хватает: 2 шт");
  expect(screen.queryByText(empty.location.name)).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Управлять резервом" }),
  ).toBeVisible();
});

it("keeps release document and original request pending, blocking a different actor", async () => {
  vi.mocked(warehouseStockApi.reservationOperation).mockRejectedValueOnce(
    new Error("Ответ потерян"),
  );
  const props = {
    data: distribution,
    source,
    onSaved: vi.fn(),
    onClose: vi.fn(),
    onSavingChange: vi.fn(),
  };
  render(<StockReservationOperationForm {...props} />);
  fireEvent.change(screen.getByLabelText(/Количество/), {
    target: { value: "1" },
  });
  fireEvent.change(screen.getByLabelText("Комментарий"), {
    target: { value: "Снять резерв" },
  });
  expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Документ"), {
    target: {
      files: [new File(["pdf"], "act.pdf", { type: "application/pdf" })],
    },
  });
  await screen.findByText("act.pdf");
  fireEvent.click(screen.getByRole("button", { name: "Убрать документ" }));
  expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Документ"), {
    target: {
      files: [new File(["pdf"], "act.pdf", { type: "application/pdf" })],
    },
  });
  await screen.findByText("act.pdf");
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await screen.findByText("Ответ потерян");
  const input = vi.mocked(warehouseStockApi.reservationOperation).mock
    .calls[0][1];
  expect(input).toMatchObject({
    action: "RELEASE",
    attachments: ["11111111-1111-4111-8111-111111111111"],
  });
  cleanup();
  render(<StockReservationOperationForm {...props} />);
  expect(screen.getByLabelText("Комментарий")).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Убрать документ" }),
  ).toBeDisabled();
  expect(screen.getByRole("button", { name: "Отмена" })).toBeDisabled();
  vi.mocked(warehouseStockApi.currentUserId).mockResolvedValueOnce(
    "another-actor",
  );
  fireEvent.click(screen.getByRole("button", { name: "Повторить операцию" }));
  await screen.findByText(
    "Сначала подтвердите предыдущую операцию под тем же пользователем.",
  );
  expect(warehouseStockApi.reservationOperation).toHaveBeenCalledTimes(1);
  expect(
    JSON.parse(
      sessionStorage.getItem("warehouse:pending-reservation-operation")!,
    ).input,
  ).toEqual(input);
  vi.mocked(warehouseStockApi.reservationOperation).mockResolvedValueOnce({});
  fireEvent.click(screen.getByRole("button", { name: "Повторить операцию" }));
  await waitFor(() => expect(props.onSaved).toHaveBeenCalledTimes(1));
  expect(
    vi.mocked(warehouseStockApi.reservationOperation).mock.calls[1][1],
  ).toEqual(input);
  expect(
    sessionStorage.getItem("warehouse:pending-reservation-operation"),
  ).toBeNull();
});
