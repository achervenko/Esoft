import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { ReceiptItemMapForm } from "./ReceiptItemMapForm";
import { receiptsApi } from "../../shared/api/warehouse-receipts-api";
import { render } from "./receipts-test-render";
import { receipt } from "./receipts-test-context";
vi.mock("../../shared/api/warehouse-receipts-api", () => ({
  receiptsApi: { mapItem: vi.fn() },
}));
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
});
it("suggests the source article for creation and submits the user's correction", async () => {
  vi.mocked(receiptsApi.mapItem).mockResolvedValue({});
  render(
    <ReceiptItemMapForm
      onSavingChange={vi.fn()}
      receipt={receipt}
      line={{
        ...receipt.lines[0],
        itemId: null,
        article: null,
        sourceArticle: "SIM-АIR-01",
      }}
      onClose={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Создать новую номенклатуру" }),
  );
  const input = screen.getByLabelText("Канонический артикул");
  expect(input).toHaveValue("SIM-АIR-01");
  fireEvent.change(input, { target: { value: "SIM-AIR-01" } });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
  await waitFor(() =>
    expect(receiptsApi.mapItem).toHaveBeenCalledWith(
      receipt.id,
      receipt.lines[0].id,
      {
        create: {
          article: "SIM-AIR-01",
          name: receipt.lines[0].name,
          unit: "шт",
        },
      },
    ),
  );
});
