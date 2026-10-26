import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NameDictionaryFormModal } from "./NameDictionaryFormModal";

afterEach(cleanup);
it("uses the standard field, trims names and blocks editing and submission while saving", () => {
  const props = {
    item: null,
    isSaving: false,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    title: "Новое название",
    maxLength: 40,
  };
  const view = render(<NameDictionaryFormModal {...props} />, {
    wrapper: ({ children }) => (
      <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
    ),
  });
  const input = screen.getByRole("textbox", { name: "Название" });
  expect(input).toBeRequired();
  expect(input).toHaveAttribute("maxlength", "40");
  expect(input).toHaveAttribute("data-dialog-autofocus");
  expect(input.closest("label")).toHaveClass("admin-control-field");
  fireEvent.change(input, { target: { value: "   " } });
  fireEvent.submit(input.closest("form")!);
  expect(props.onSubmit).not.toHaveBeenCalled();
  expect(input).toHaveAccessibleName("Название");
  expect(input).toHaveAccessibleDescription("Укажите название.");
  fireEvent.change(input, { target: { value: " Новое имя " } });
  fireEvent.submit(input.closest("form")!);
  expect(props.onSubmit).toHaveBeenCalledWith({ name: "Новое имя" });
  view.rerender(<NameDictionaryFormModal {...props} isSaving />);
  expect(input).toBeDisabled();
  expect(screen.getByRole("button", { name: "Отмена" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Сохранение..." })).toBeDisabled();
  fireEvent.submit(input.closest("form")!);
  expect(props.onSubmit).toHaveBeenCalledOnce();
});
