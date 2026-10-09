import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EquipmentEventFormModal } from "./EquipmentEventFormModal";

afterEach(cleanup);

it("blocks every close action while saving and restores closing afterwards", () => {
  const onClose = vi.fn();
  const props = {
    checklistTemplates: [],
    maintenanceSettings: [],
    users: [],
    mode: "create" as const,
    onClose,
    onSubmit: vi.fn(),
  };
  const view = render(<EquipmentEventFormModal {...props} isSaving />);
  expect(screen.getByRole("button", { name: "Отмена" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Закрыть" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
  fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  fireEvent.mouseDown(document.querySelector(".admin-modal-backdrop")!);
  expect(onClose).not.toHaveBeenCalled();
  view.rerender(<EquipmentEventFormModal {...props} isSaving={false} />);
  expect(screen.getByRole("button", { name: "Отмена" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Закрыть" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
  expect(onClose).toHaveBeenCalledOnce();
});
