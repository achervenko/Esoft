import { afterEach, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { ReceiptActionDialog, type ReceiptAction } from "./ReceiptActionDialog";
import { render } from "./receipts-test-render";
import { receipt } from "./receipts-test-context";
vi.mock("./ReceiptPlaceForm", () => ({
  ReceiptPlaceForm: () => <div>place form</div>,
}));
vi.mock("./ReceiptItemMapForm", () => ({
  ReceiptItemMapForm: () => <div>item form</div>,
}));
vi.mock("./ReceiptConflictResolveForm", () => ({
  ReceiptConflictResolveForm: () => <div>resolve form</div>,
}));
vi.mock("./ReceiptCancelForm", () => ({
  ReceiptCancelForm: () => <div>cancel form</div>,
}));
afterEach(cleanup);
it.each([
  [{ kind: "place", line: receipt.lines[0] }, "Разместить товар"],
  [{ kind: "item", line: receipt.lines[0] }, "Сопоставить номенклатуру"],
  [{ kind: "resolve" }, "Решить конфликт"],
  [{ kind: "cancel" }, "Отменить приход"],
] satisfies [ReceiptAction, string][])(
  "routes %j to its form",
  (action, title) => {
    render(
      <ReceiptActionDialog
        actorId="actor"
        receipt={receipt}
        action={action}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByRole("dialog", { name: title })).toBeInTheDocument();
    expect(screen.getByText(action.kind + " form")).toBeInTheDocument();
    expect(screen.getAllByText(/ form$/)).toHaveLength(1);
  },
);
