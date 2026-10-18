import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { AdminUserAccount } from "../../shared/api/users-admin-api";
import { UserAccountFormModal } from "./UserAccountFormModal";

afterEach(cleanup);

it.each([false, true])(
  "associates field errors in create/edit mode (edit=%s)",
  (edit) => {
    const onSubmit = vi.fn();
    const user = edit
      ? ({
          email: "",
          username: "",
          role: "operator",
          employee: null,
        } as AdminUserAccount)
      : null;
    render(
      <UserAccountFormModal
        user={user}
        employees={[]}
        roles={[]}
        isSaving={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    const labels = edit ? ["Email", "Логин"] : ["Email", "Логин", "Пароль"];
    fireEvent.submit(document.querySelector("form")!);
    for (const label of edit ? ["Сотрудник"] : ["Сотрудник", "Роль"]) {
      const control = screen.getByLabelText(new RegExp(`^${label}`));
      expect(control).toHaveAttribute("aria-invalid", "true");
      const errorId = control.getAttribute("aria-describedby");
      expect(errorId).toBeTruthy();
      expect(document.getElementById(errorId!)).toHaveClass("field-error");
    }
    for (const label of labels) {
      const input = screen.getByLabelText((text) =>
        text.replaceAll("*", "").trim().startsWith(label),
      );
      expect(input).toBeRequired();
      expect(input).toHaveAttribute("aria-invalid", "true");
      const errorId = input.getAttribute("aria-describedby");
      expect(errorId).toBeTruthy();
      expect(document.getElementById(errorId!)).toHaveClass("field-error");
    }
    if (edit) expect(screen.queryByLabelText(/Пароль/)).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
    const email = screen.getByLabelText(/Email/);
    fireEvent.change(email, { target: { value: "valid@example.com" } });
    expect(email).not.toHaveAttribute("aria-invalid");
    expect(email).not.toHaveAttribute("aria-describedby");
  },
);

it("preserves an existing disabled module role when editing account details", () => {
  const onSubmit = vi.fn();
  const user = {
    email: "engineer@example.com",
    username: "engineer",
    role: "engineer",
    roleLabel: "Инженер",
    employee: { id: 1 },
  } as AdminUserAccount;
  render(
    <UserAccountFormModal
      user={user}
      employees={[]}
      roles={[{ value: "operator", label: "Оператор" }]}
      isSaving={false}
      onClose={vi.fn()}
      onSubmit={onSubmit}
    />,
  );
  expect(screen.getByText("Инженер (модуль выключен)")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Email/), {
    target: { value: "updated@example.com" },
  });
  fireEvent.submit(document.querySelector("form")!);
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ role: "engineer", email: "updated@example.com" }),
  );
});

it("edits a role set and allows removal of an inactive role", async () => {
  const onSubmit = vi.fn();
  const user = {
    email: "engineer@example.com",
    username: "engineer",
    role: "engineer,storekeeper",
    roleLabel: "Инженер, Кладовщик",
    employee: { id: 1 },
  } as AdminUserAccount;
  render(
    <UserAccountFormModal
      user={user}
      employees={[]}
      roles={[
        { value: "engineer", label: "Инженер" },
        { value: "auditor", label: "Аудитор" },
      ]}
      isSaving={false}
      onClose={vi.fn()}
      onSubmit={onSubmit}
    />,
  );
  expect(screen.getByLabelText("Инженер")).toBeChecked();
  expect(screen.getByLabelText("Кладовщик (модуль выключен)")).toBeChecked();
  fireEvent.click(screen.getByLabelText("Аудитор"));
  await act(async () => {
    fireEvent.submit(document.querySelector("form")!);
  });
  expect(onSubmit).toHaveBeenLastCalledWith(
    expect.objectContaining({ role: "engineer,auditor,storekeeper" }),
  );
  fireEvent.click(screen.getByLabelText("Кладовщик (модуль выключен)"));
  expect(screen.getByLabelText("Кладовщик (модуль выключен)")).toBeDisabled();
  await act(async () => {
    fireEvent.submit(document.querySelector("form")!);
  });
  expect(onSubmit).toHaveBeenLastCalledWith(
    expect.objectContaining({ role: "engineer,auditor" }),
  );
});

it.each([false, true])(
  "blocks duplicate submits and unlocks after the parent handles saving (failure=%s)",
  async (fails) => {
    let complete!: () => void;
    let fail!: (error: Error) => void;
    const onSubmit = vi.fn().mockReturnValue(
      new Promise<void>((resolve, reject) => {
        complete = resolve;
        fail = reject;
      }).catch(() => {
        /* The parent displays save errors and resolves its action. */
      }),
    );
    const user = {
      email: "user@example.test",
      username: "user",
      role: "auditor",
      employee: { id: 1 },
    } as AdminUserAccount;
    render(
      <UserAccountFormModal
        user={user}
        employees={[]}
        roles={[{ value: "auditor", label: "Аудитор" }]}
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
      if (fails) fail(new Error("Save failed"));
      else complete();
    });
    onSubmit.mockReturnValue(new Promise<void>(() => {}));
    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });
    expect(onSubmit).toHaveBeenCalledTimes(2);
  },
);
