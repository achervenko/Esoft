import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { AdminUserAccount } from "../../shared/api/users-admin-api";
import { PasswordFormModal } from "./PasswordFormModal";

afterEach(cleanup);
const user = {
  username: "Admin123",
  email: "User1@example.com",
} as AdminUserAccount;

it.each(["aaaaaaaa", "12345678", "ADMIN123", "USER1@EXAMPLE.COM", "A1".repeat(65)])(
  "does not submit invalid password %s",
  (password) => {
    const onSubmit = vi.fn();
    render(<PasswordFormModal user={user} isSaving={false} onClose={vi.fn()} onSubmit={onSubmit} />);
    const input = screen.getByLabelText(/Новый пароль/);
    expect(input).toHaveAttribute("maxlength", "128");
    expect(input).toBeRequired();
    fireEvent.change(input, { target: { value: password } });
    fireEvent.submit(input.closest("form")!);
    expect(onSubmit).not.toHaveBeenCalled();
    const error = screen.getByText(/Пароль должен содержать/);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", error.id);
  },
);

it("submits a valid password without altering it", () => {
  const onSubmit = vi.fn();
  render(<PasswordFormModal user={user} isSaving={false} onClose={vi.fn()} onSubmit={onSubmit} />);
  const input = screen.getByLabelText(/Новый пароль/);
  fireEvent.change(input, { target: { value: "Secure1234" } });
  fireEvent.submit(input.closest("form")!);
  expect(onSubmit).toHaveBeenCalledWith("Secure1234");
});
