import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  AdminTextField,
  AdminTextareaField,
  AdminFormActions,
} from "./AdminFormControls";

afterEach(cleanup);

it("passes native input properties and keeps the field name independent of required marks and errors", () => {
  const onChange = vi.fn();
  const onFocus = vi.fn();
  const inputRef = createRef<HTMLInputElement>();
  render(
    <AdminTextField
      label="Код"
      required
      value="A-01"
      onChange={onChange}
      error="Код уже занят"
      inputRef={inputRef}
      selectOnFocus
      onFocus={onFocus}
      id="location-code"
      name="code"
      maxLength={100}
      autoComplete="off"
      data-dialog-autofocus
    />,
  );
  const input = screen.getByRole("textbox", { name: "Код" });
  expect(screen.getByLabelText("Код")).toBe(input);
  expect(input).toBeRequired();
  expect(input).toHaveAttribute("name", "code");
  expect(input).toHaveAttribute("maxlength", "100");
  expect(input).toHaveAttribute("autocomplete", "off");
  expect(input).toHaveAttribute("data-dialog-autofocus");
  expect(inputRef.current).toBe(input);
  expect(input).toHaveAccessibleDescription("Код уже занят");
  expect(input).toHaveAttribute("aria-invalid", "true");
  fireEvent.focus(input);
  expect(onFocus).toHaveBeenCalledOnce();
  expect(inputRef.current?.selectionStart).toBe(0);
  expect(inputRef.current?.selectionEnd).toBe(4);
  fireEvent.change(input, { target: { value: "B-02" } });
  expect(onChange).toHaveBeenCalledWith("B-02");
});

it("supports native textarea properties, warnings and optional fields", () => {
  const onChange = vi.fn();
  render(
    <AdminTextareaField
      label="Комментарий"
      value=""
      onChange={onChange}
      rows={4}
      maxLength={200}
      warning="Необязательное поле"
      className="custom"
    />,
  );
  const input = screen.getByRole("textbox", {
    name: "Комментарий",
  });
  expect(input).not.toBeRequired();
  expect(input).toHaveAttribute("rows", "4");
  expect(input).toHaveAttribute("maxlength", "200");
  expect(input).toHaveClass("admin-control-textarea", "custom");
  expect(input).toHaveAccessibleDescription("Необязательное поле");
  expect(input).not.toHaveAttribute("aria-invalid");
  fireEvent.change(input, { target: { value: "Примечание" } });
  expect(onChange).toHaveBeenCalledWith("Примечание");
});

it("separates a disabled submit from saving and keeps cancellation available", () => {
  const onClose = vi.fn();
  const view = render(
    <AdminFormActions isSaving={false} submitDisabled onClose={onClose} />,
  );
  expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
  expect(onClose).toHaveBeenCalledOnce();
  view.rerender(<AdminFormActions isSaving onClose={onClose} />);
  expect(screen.getByRole("button", { name: "Сохранение..." })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Отмена" })).toBeDisabled();
});
