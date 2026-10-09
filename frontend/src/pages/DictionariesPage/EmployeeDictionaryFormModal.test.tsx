import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EmployeeDictionaryFormModal } from "./EmployeeDictionaryFormModal";

afterEach(cleanup);

it("requires first and last names and blocks closing during saving", () => {
  const onClose = vi.fn();
  const props = { employee: null, positions: [], onClose, onSubmit: vi.fn() };
  const view = render(<EmployeeDictionaryFormModal {...props} isSaving />);
  expect(screen.getByLabelText(/Фамилия/)).toBeRequired();
  expect(screen.getByLabelText(/^Имя/)).toBeRequired();
  expect(screen.getByLabelText("Отчество")).not.toBeRequired();
  expect(screen.getByRole("button", { name: "Отмена" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Закрыть" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
  fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  fireEvent.mouseDown(document.querySelector(".admin-modal-backdrop")!);
  expect(onClose).not.toHaveBeenCalled();
  view.rerender(<EmployeeDictionaryFormModal {...props} isSaving={false} />);
  expect(screen.getByRole("button", { name: "Закрыть" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
  expect(onClose).toHaveBeenCalledOnce();
});
