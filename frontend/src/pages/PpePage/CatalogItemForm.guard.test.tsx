import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CatalogItemForm } from "./CatalogItemForm";
it("detects actual catalogue changes and stops prompting after values are restored", () => {
  const close = vi.fn();
  render(
    <ChakraProvider value={defaultSystem}>
      <CatalogItemForm item={null} items={[]} onClose={close} onChanged={vi.fn()} />
    </ChakraProvider>,
  );
  const name = screen.getByLabelText("Наименование");
  fireEvent.change(name, { target: { value: "Костюм" } });
  fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Остаться" }));
  expect(name).toHaveValue("Костюм");
  fireEvent.change(name, { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
  expect(close).toHaveBeenCalledOnce();
});
