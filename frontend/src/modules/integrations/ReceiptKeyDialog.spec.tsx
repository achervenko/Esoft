import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { ReceiptKeyDialog } from "./ReceiptKeyDialog";
import { receiptIntegrationApi } from "../../shared/api/receipt-integration-api";
vi.mock("../../shared/api/receipt-integration-api", () => ({
  receiptIntegrationApi: { createKey: vi.fn() },
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("issues once with the default expiry and forgets the secret on close", async () => {
  vi.mocked(receiptIntegrationApi.createKey).mockResolvedValue({
    id: "1",
    key: "test-key",
  });
  const created = vi.fn();
  const view = render(
    <ReceiptKeyDialog
      source="ONE_C"
      flows={[{ value: "warehouse.receipts", label: "Приходы склада" }]}
      onCreated={created}
      onClose={() => view.unmount()}
    />,
  );
  const submit = screen.getByRole("button", { name: "Выпустить" });
  fireEvent.click(submit);
  fireEvent.click(submit);
  expect(await screen.findByDisplayValue("test-key")).toBeInTheDocument();
  expect(receiptIntegrationApi.createKey).toHaveBeenCalledExactlyOnceWith(
    "ONE_C",
    {
      name: "Обмен 1С",
      expiresIn: 31536000,
      flows: { "warehouse.receipts": ["event:create"] },
    },
  );
  expect(created).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Готово" }));
  expect(screen.queryByDisplayValue("test-key")).not.toBeInTheDocument();
});
it("rejects an invalid expiry without sending a request", () => {
  render(
    <ReceiptKeyDialog
      source="ONE_C"
      flows={[{ value: "warehouse.receipts", label: "Приходы склада" }]}
      onCreated={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("Срок действия, дней"), {
    target: { value: "366" },
  });
  expect(screen.getByRole("button", { name: "Выпустить" })).toBeDisabled();
  expect(receiptIntegrationApi.createKey).not.toHaveBeenCalled();
});
