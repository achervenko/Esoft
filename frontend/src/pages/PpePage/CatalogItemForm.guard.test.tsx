import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CatalogItemForm } from "./CatalogItemForm";
afterEach(cleanup);
it("detects actual catalogue changes and stops prompting after values are restored", () => {
  const close = vi.fn();
  render(
    <ChakraProvider value={defaultSystem}>
      <CatalogItemForm item={null} onClose={close} onChanged={vi.fn()} />
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
