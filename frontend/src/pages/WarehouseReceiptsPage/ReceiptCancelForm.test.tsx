import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { ReceiptCancelForm } from "./ReceiptCancelForm";
import { receiptsApi } from "../../shared/api/warehouse-receipts-api";
import { render } from "./receipts-test-render";
import { receipt } from "./receipts-test-context";
vi.mock("../../shared/api/warehouse-receipts-api", () => ({
  receiptsApi: { cancel: vi.fn() },
}));
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
});
it("reports cancellation failure and allows retry", async () => {
  vi.mocked(receiptsApi.cancel)
    .mockRejectedValueOnce(new Error("Cancel failed"))
    .mockResolvedValue({});
  const onSaved = vi.fn();
  render(
    <ReceiptCancelForm
      onSavingChange={vi.fn()}
      receipt={receipt}
      onClose={vi.fn()}
      onSaved={onSaved}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await screen.findByText("Cancel failed");
  expect(onSaved).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Отмена" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(receiptsApi.cancel).toHaveBeenCalledTimes(2);
});
