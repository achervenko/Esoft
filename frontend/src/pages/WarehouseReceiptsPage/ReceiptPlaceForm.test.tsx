import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
} from "@testing-library/react";
import { ReceiptPlaceForm } from "./ReceiptPlaceForm";
import { receiptsApi } from "../../shared/api/warehouse-receipts-api";
import { render } from "./receipts-test-render";
import { receipt } from "./receipts-test-context";
import { ApiRequestError } from "../../shared/api/api-error";
vi.mock("../../shared/api/warehouse-receipts-api", () => ({
  receiptsApi: { place: vi.fn(), get: vi.fn() },
}));
vi.mock("./useReceiptStorage", () => ({
  useReceiptStorage: () => ({
    warehouses: [{ id: "5", name: "Основной склад" }],
    locations: [{ id: "4", name: "Полка А" }],
    error: null,
  }),
}));
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
});
async function choosePlace() {
  fireEvent.click(screen.getByRole("combobox", { name: "Место хранения" }));
  fireEvent.click(await screen.findByRole("option", { name: "Полка А" }));
}
it.each(["0", "2", "offline"])(
  "refreshes a stale placement after another employee commits: %s",
  async (remaining) => {
    vi.mocked(receiptsApi.place).mockRejectedValue(
      new ApiRequestError(
        "Количество превышает остаток к размещению.",
        409,
        "WAREHOUSE_RECEIPT_OVERPLACEMENT",
      ),
    );
    if (remaining === "offline")
      vi.mocked(receiptsApi.get).mockRejectedValue(Error("offline"));
    else
      vi.mocked(receiptsApi.get).mockResolvedValue({
        ...receipt,
        lines: [{ ...receipt.lines[0], remaining }],
      });
    render(
      <ReceiptPlaceForm
        actorId="actor"
        onSavingChange={vi.fn()}
        receipt={receipt}
        line={receipt.lines[0]}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    await choosePlace();
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    await screen.findByText(
      remaining === "0"
        ? /Товар уже полностью размещён/
        : remaining === "offline"
          ? /Не удалось обновить данные/
          : /Часть товара уже размещена/,
    );
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();
    if (remaining !== "offline")
      expect(
        screen.getByText(`Осталось разместить: ${remaining} шт`),
      ).toBeInTheDocument();
    if (remaining === "2") {
      fireEvent.change(screen.getByLabelText("Количество, шт"), {
        target: { value: "2" },
      });
      expect(screen.getByRole("button", { name: "Сохранить" })).toBeEnabled();
    }
  },
);

it("shows recovery notice only after an uncertain failure, not while saving", async () => {
  let reject!: (error: Error) => void;
  vi.mocked(receiptsApi.place).mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  render(
    <ReceiptPlaceForm
      actorId="actor"
      onSavingChange={vi.fn()}
      receipt={receipt}
      line={receipt.lines[0]}
      onClose={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  await choosePlace();
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await waitFor(() => expect(receiptsApi.place).toHaveBeenCalledOnce());
  expect(
    screen.queryByText(/Предыдущая отправка ещё не подтверждена/),
  ).not.toBeInTheDocument();
  await act(async () => reject(new Error("Нет ответа")));
  expect(
    await screen.findByText(/Предыдущая отправка ещё не подтверждена/),
  ).toBeInTheDocument();
});

it("reuses the placement request key after an uncertain failure", async () => {
  vi.mocked(receiptsApi.place)
    .mockRejectedValueOnce(new Error("Нет связи"))
    .mockResolvedValueOnce({});
  const onSaved = vi.fn();
  render(
    <ReceiptPlaceForm
      actorId="actor"
      onSavingChange={vi.fn()}
      receipt={receipt}
      line={receipt.lines[0]}
      onClose={vi.fn()}
      onSaved={onSaved}
    />,
  );
  await choosePlace();
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await screen.findByText("Нет связи");
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  const calls = vi.mocked(receiptsApi.place).mock.calls;
  expect(calls).toHaveLength(2);
  expect(calls[0]).toEqual(calls[1]);
  expect(calls[0][2]).toMatchObject({ storageLocationId: "4", quantity: "6" });
  expect(calls[0][2].requestKey).toMatch(/^[0-9a-f-]{36}$/);
});

it("does not submit overplacement or negative quantities", async () => {
  render(
    <ReceiptPlaceForm
      actorId="actor"
      onSavingChange={vi.fn()}
      receipt={receipt}
      line={receipt.lines[0]}
      onClose={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  await choosePlace();
  const quantity = screen.getByLabelText("Количество, шт");
  fireEvent.change(quantity, { target: { value: "7" } });
  expect(screen.getByText(/Нельзя больше/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();
  fireEvent.change(quantity, { target: { value: "-1" } });
  expect(screen.getByText(/отрицательным/)).toBeInTheDocument();
  expect(receiptsApi.place).not.toHaveBeenCalled();
});

it("recovers a placement after closing the dialog even if remaining quantity changed", async () => {
  vi.mocked(receiptsApi.place)
    .mockRejectedValueOnce(new TypeError("Ответ потерян"))
    .mockResolvedValueOnce({});
  const first = render(
    <ReceiptPlaceForm
      actorId="actor"
      onSavingChange={vi.fn()}
      receipt={receipt}
      line={receipt.lines[0]}
      onClose={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  await choosePlace();
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await screen.findByText("Ответ потерян");
  first.unmount();
  const onSaved = vi.fn();
  render(
    <ReceiptPlaceForm
      actorId="actor"
      onSavingChange={vi.fn()}
      receipt={receipt}
      line={{ ...receipt.lines[0], remaining: "0" }}
      onClose={vi.fn()}
      onSaved={onSaved}
    />,
  );
  expect(screen.getByLabelText("Количество, шт")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(vi.mocked(receiptsApi.place).mock.calls[0]).toEqual(
    vi.mocked(receiptsApi.place).mock.calls[1],
  );
});
