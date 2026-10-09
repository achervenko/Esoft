import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SetupPage } from "./SetupPage";
const api = vi.hoisted(() => ({
  createInitialAdmin: vi.fn(),
  getSetupEmployees: vi.fn(),
}));
vi.mock("../../shared/api/setup", () => api);
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("creates a new employee without any seeded employees", async () => {
  api.getSetupEmployees.mockResolvedValue({ employees: [] });
  api.createInitialAdmin.mockResolvedValue({ ok: true });
  render(<SetupPage onCompleted={vi.fn()} />);
  await screen.findByLabelText(/Фамилия/);
  expect(
    screen.queryByText(/В системе ещё нет администратора/),
  ).not.toBeInTheDocument();
  for (const [label, value] of [
    ["Фамилия", "Иванов"],
    ["Имя", "Иван"],
    ["Email", "admin@example.test"],
    ["Логин", "admin"],
    ["Пароль", "Secure1234"],
    ["Повторите пароль", "Secure1234"],
  ]) {
    fireEvent.change(
      screen.getByLabelText(
        (text) => text.replaceAll("*", "").trim() === label,
      ),
      {
        target: { value },
      },
    );
  }
  fireEvent.click(
    screen.getByRole("button", { name: "Создать администратора" }),
  );
  await waitFor(() =>
    expect(api.createInitialAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        employee: { lastName: "Иванов", firstName: "Иван", middleName: null },
      }),
    ),
  );
  expect(api.createInitialAdmin.mock.calls[0][0]).not.toHaveProperty(
    "employeeId",
  );
});

it("associates validation errors with every affected input", async () => {
  api.getSetupEmployees.mockResolvedValue({ employees: [] });
  render(<SetupPage onCompleted={vi.fn()} />);
  await screen.findByLabelText(/Фамилия/);
  for (const [label, value] of [
    ["Отчество", "x".repeat(65)],
    ["Email", "invalid"],
    ["Логин", "!"],
    ["Пароль", "aaaaaaaa"],
    ["Повторите пароль", "different"],
  ]) {
    fireEvent.change(screen.getByLabelText((text) => text.replaceAll("*", "").trim() === label), {
      target: { value },
    });
  }
  fireEvent.submit(document.querySelector("form")!);
  for (const label of ["Фамилия", "Имя", "Отчество", "Email", "Логин", "Пароль", "Повторите пароль"]) {
    const input = screen.getByLabelText((text) => text.replaceAll("*", "").trim().startsWith(label));
    expect(input).toHaveAttribute("aria-invalid", "true");
    const errorId = input.getAttribute("aria-describedby");
    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId!)).toHaveClass("field-error");
  }
  expect(api.createInitialAdmin).not.toHaveBeenCalled();
});
