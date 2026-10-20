import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EmployeeDictionaryFormModal } from "./EmployeeDictionaryFormModal";
import type { AdminEmployee } from "../../shared/api/users-admin-api";

afterEach(cleanup);

it("requires gender for a legacy employee and submits the selected value", async () => {
  const onSubmit = vi.fn();
  render(<EmployeeDictionaryFormModal
    employee={{ firstName: "Иван", lastName: "Иванов", gender: null, positionId: 1 } as AdminEmployee}
    positions={[{ id: 1, name: "Механик", isActive: true }]}
    isSaving={false} onClose={vi.fn()} onSubmit={onSubmit}
  />);
  fireEvent.submit(document.querySelector("form")!);
  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByText("Заполните фамилию, имя, пол и должности.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: "Женский" }));
  fireEvent.submit(document.querySelector("form")!);
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ gender: "FEMALE" }));
  await act(async () => {});
});

it("edits additional positions independently from the main position", async () => {
  const onSubmit = vi.fn();
  render(
    <EmployeeDictionaryFormModal
      isSaving={false}
      onClose={vi.fn()}
      onSubmit={onSubmit}
      employee={
        {
          gender: "MALE",
          firstName: "Иван",
          lastName: "Иванов",
          middleName: null,
          positionId: 1,
          additionalPositions: [{ id: 2, name: "Сварщик" }],
        } as AdminEmployee
      }
      positions={[
        { id: 1, name: "Механик", isActive: true },
        { id: 2, name: "Сварщик", isActive: true },
        { id: 3, name: "Водитель", isActive: true },
      ]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Должности" }));
  expect(screen.getByRole("listbox")).toHaveAttribute("aria-multiselectable", "true");
  expect(screen.getByRole("option", { name: "Сварщик" })).toHaveAttribute("aria-selected", "true");
  fireEvent.click(screen.getByRole("option", { name: "Водитель" }));
  fireEvent.submit(document.querySelector("form")!);
  expect(onSubmit).toHaveBeenLastCalledWith(
    expect.objectContaining({ positionId: 1, additionalPositionIds: [2, 3] }),
  );
  await act(async () => {});
  fireEvent.click(screen.getByRole("option", { name: "Сварщик" }));
  fireEvent.submit(document.querySelector("form")!);
  expect(onSubmit).toHaveBeenLastCalledWith(
    expect.objectContaining({ positionId: 1, additionalPositionIds: [3] }),
  );
  await act(async () => {});
  fireEvent.keyDown(screen.getByRole("option", { name: "Механик" }), { key: " " });
  expect(screen.getByRole("option", { name: "Механик" })).toHaveAttribute("aria-selected", "false");
  fireEvent.keyDown(screen.getByRole("option", { name: "Механик" }), { key: "Escape" });
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  fireEvent.submit(document.querySelector("form")!);
  expect(onSubmit).toHaveBeenLastCalledWith(
    expect.objectContaining({ positionId: 3, additionalPositionIds: [] }),
  );
});

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

it("blocks repeated submits until saving settles and allows retry after failure", async () => {
  let rejectSave!: (reason: Error) => void;
  const onSubmit = vi.fn(
    () =>
      new Promise<void>((_resolve, reject) => {
        rejectSave = reject;
      }),
  );
  render(
    <EmployeeDictionaryFormModal
      employee={
        {
          gender: "MALE",
          firstName: "Иван",
          lastName: "Иванов",
          positionId: 1,
        } as AdminEmployee
      }
      positions={[{ id: 1, name: "Механик", isActive: true }]}
      isSaving={false}
      onClose={vi.fn()}
      onSubmit={onSubmit}
    />,
  );
  const form = document.querySelector("form")!;
  act(() => {
    fireEvent.submit(form);
    fireEvent.submit(form);
  });
  expect(onSubmit).toHaveBeenCalledTimes(1);
  await act(async () => {
    rejectSave(new Error("failed"));
  });
  expect(
    screen.getByText("Не удалось сохранить сотрудника. Попробуйте ещё раз."),
  ).toBeInTheDocument();
  fireEvent.submit(form);
  expect(onSubmit).toHaveBeenCalledTimes(2);
});
