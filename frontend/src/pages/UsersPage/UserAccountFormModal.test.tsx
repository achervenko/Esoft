import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { AdminUserAccount } from "../../shared/api/users-admin-api";
import { UserAccountFormModal } from "./UserAccountFormModal";

afterEach(cleanup);

it.each([false, true])("associates field errors in create/edit mode (edit=%s)", (edit) => {
  const onSubmit = vi.fn();
  const user = edit ? { email: "", username: "", role: "operator", employee: null } as AdminUserAccount : null;
  render(<UserAccountFormModal user={user} employees={[]} roles={[]} isSaving={false} onClose={vi.fn()} onSubmit={onSubmit} />);
  const labels = edit ? ["Email", "Логин"] : ["Email", "Логин", "Пароль"];
  fireEvent.submit(document.querySelector("form")!);
  for (const label of ["Сотрудник", "Роль"]) {
    const control = screen.getByLabelText(new RegExp(`^${label}`));
    expect(control).toHaveAttribute("aria-invalid", "true");
    const errorId = control.getAttribute("aria-describedby");
    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId!)).toHaveClass("field-error");
  }
  for (const label of labels) {
    const input = screen.getByLabelText((text) => text.replaceAll("*", "").trim().startsWith(label));
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
});
