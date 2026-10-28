import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { FormField } from "./FormField";
import { AdminTextField } from "./AdminFormControls";

it("keeps a dismissed message only for collapse and cancels removal when an error returns", () => {
  vi.useFakeTimers();
  const view = render(
    <FormField label="Количество" error="Ошибка">
      <input />
    </FormField>,
  );
  try {
    view.rerender(
      <FormField label="Количество">
        <input />
      </FormField>,
    );
    const message = screen.getByText("Ошибка");
    expect(message).toHaveAttribute("data-visible", "false");
    expect(message).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-describedby");
    act(() => vi.advanceTimersByTime(180));
    expect(message).toBeInTheDocument();
    view.rerender(
      <FormField label="Количество" error="Другая ошибка">
        <input />
      </FormField>,
    );
    act(() => vi.advanceTimersByTime(360));
    expect(screen.getByText("Другая ошибка")).toHaveAttribute(
      "data-visible",
      "true",
    );
    view.rerender(
      <FormField label="Количество">
        <input />
      </FormField>,
    );
    act(() => vi.advanceTimersByTime(360));
    expect(screen.queryByText("Другая ошибка")).toBeNull();
  } finally {
    view.unmount();
    vi.useRealTimers();
  }
});

it("keeps the input handler and associates field errors with its control", () => {
  const onChange = vi.fn();
  const view = render(
    <FormField label="Название" error="Заполните название" required>
      <input aria-describedby="existing-hint" onChange={onChange} />
    </FormField>,
  );
  const input = screen.getByRole("textbox");
  expect(input).toBeRequired();
  expect(input).toHaveAttribute("aria-required", "true");
  expect(input).toHaveAttribute("aria-invalid", "true");
  const error = screen.getByText("Заполните название");
  expect(input.getAttribute("aria-describedby")).toBe(
    `existing-hint ${error.id}`,
  );
  fireEvent.change(input, { target: { value: "Костюм" } });
  expect(onChange).toHaveBeenCalledOnce();
  view.rerender(
    <FormField label="Название">
      <input aria-describedby="existing-hint" />
    </FormField>,
  );
  expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-invalid");
  expect(screen.getByRole("textbox")).not.toBeRequired();
  expect(screen.getByRole("textbox")).toHaveAttribute(
    "aria-describedby",
    "existing-hint",
  );
});

it.each([
  { kind: "input", control: <input /> },
  {
    kind: "select",
    control: (
      <select>
        <option value="">Выберите</option>
      </select>
    ),
  },
  { kind: "textarea", control: <textarea /> },
])("marks a native $kind required", ({ kind, control }) => {
  const view = render(
    <FormField label="Поле" required>
      {control}
    </FormField>,
  );
  const field = view.container.querySelector(kind);
  expect(field).toHaveAttribute("required");
  expect(field).toHaveAttribute("aria-required", "true");
  view.unmount();
});

it("does not apply required attributes to a button", () => {
  const view = render(
    <FormField label="Поле" required>
      <button type="button">Выбрать</button>
    </FormField>,
  );
  const button = screen.getByRole("button");
  expect(button).not.toHaveAttribute("required");
  expect(button).not.toHaveAttribute("aria-required");
  view.unmount();
});

it("preserves required attributes specified directly on the control", () => {
  const view = render(
    <FormField label="Поле">
      <input required aria-required="true" />
    </FormField>,
  );
  const input = view.container.querySelector("input");
  expect(input).toHaveAttribute("required");
  expect(input).toHaveAttribute("aria-required", "true");
  view.unmount();
});

it("uses the shared field shell for an administrative text control", () => {
  render(<AdminTextField label="Артикул" value="C-1" onChange={vi.fn()} />);
  const field = screen.getByLabelText("Артикул").closest("label");
  expect(field).toHaveClass("form-field", "admin-control-field");
});

it("identifies the label without marking nested control content", () => {
  const view = render(
    <FormField label="Выбор" hideLabel>
      <span>Подсказка</span>
      <button type="button">
        <span>Открыть</span>
      </button>
    </FormField>,
  );
  expect(screen.getByText("Выбор").closest(".form-field-label")).toHaveClass(
    "form-field-label",
    "admin-control-label-hidden",
  );
  const content = screen.getByText("Открыть");
  expect(screen.getByText("Подсказка")).not.toHaveClass("form-field-label");
  expect(content).not.toHaveClass("form-field-label");
  expect(content.matches("label.form-field > span")).toBe(false);
  view.unmount();
});

it("associates a non-blocking warning and gives errors priority", () => {
  const { rerender } = render(
    <FormField label="Название" warning="Название уже есть">
      <input />
    </FormField>,
  );
  const input = screen.getByRole("textbox");
  const warning = screen.getByText("Название уже есть");
  expect(warning).toHaveClass("field-warning");
  expect(input).toHaveAttribute("aria-describedby", warning.id);
  expect(input).not.toHaveAttribute("aria-invalid");
  expect(input.closest("label")).toHaveClass("has-warning");
  rerender(
    <FormField label="Название" warning="Название уже есть" error="Ошибка">
      <input />
    </FormField>,
  );
  expect(screen.queryByText("Название уже есть")).not.toBeInTheDocument();
  expect(screen.getByText("Ошибка")).toHaveClass("field-error");
  expect(input.closest("label")).not.toHaveClass("has-warning");
});
