import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";
import { AdminModal } from "./AdminModal";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("focuses cancel, traps Tab, and restores the trigger", () => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
    { width: 1, height: 1 },
  ] as unknown as DOMRectList);
  const trigger = document.createElement("button");
  document.body.append(trigger);
  trigger.focus();
  const view = render(
    <ConfirmDialog
      title="Удаление"
      description="Удалить?"
      cancelLabel="Назад"
      confirmLabel="Удалить"
      onCancel={vi.fn()}
      onConfirm={vi.fn()}
    />,
  );
  const cancel = screen.getByRole("button", { name: "Назад" });
  const confirm = screen.getByRole("button", { name: "Удалить" });
  expect(cancel).toHaveFocus();
  fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
  expect(confirm).toHaveFocus();
  fireEvent.keyDown(confirm, { key: "Tab" });
  expect(cancel).toHaveFocus();
  view.unmount();
  expect(trigger).toHaveFocus();
  trigger.remove();
});
it("does not let Escape from a nested confirmation close its parent", () => {
  const parentClose = vi.fn();
  const cancel = vi.fn();
  render(
    <AdminModal title="Форма" onClose={parentClose}>
      <ConfirmDialog
        title="Подтверждение"
        description="Продолжить?"
        cancelLabel="Назад"
        confirmLabel="Да"
        onCancel={cancel}
        onConfirm={vi.fn()}
      />
    </AdminModal>,
  );
  fireEvent.keyDown(screen.getByRole("dialog", { name: "Подтверждение" }), {
    key: "Escape",
  });
  expect(cancel).toHaveBeenCalledOnce();
  expect(parentClose).not.toHaveBeenCalled();
});
it("blocks Escape and backdrop dismissal while loading", () => {
  const cancel = vi.fn();
  render(
    <ConfirmDialog
      title="Удаление"
      description="Удалить?"
      cancelLabel="Назад"
      confirmLabel="Удалить"
      isLoading
      onCancel={cancel}
      onConfirm={vi.fn()}
    />,
  );
  const dialog = screen.getByRole("dialog");
  fireEvent.keyDown(dialog, { key: "Escape" });
  fireEvent.mouseDown(dialog);
  expect(cancel).not.toHaveBeenCalled();
});
