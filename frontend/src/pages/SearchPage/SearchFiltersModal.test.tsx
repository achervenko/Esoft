import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SearchFiltersModal } from "./SearchFiltersModal";
afterEach(cleanup);
it("allows selecting both modules and resetting the selection", () => {
  const apply = vi.fn();
  render(<SearchFiltersModal availableModules={[{id:"equipment",label:"Оборудование"},{id:"ppe",label:"СИЗ"}]} module="equipment" onApply={apply} onClose={vi.fn()} />);
  expect(screen.getByRole("checkbox", { name: "Оборудование" })).toBeChecked();
  fireEvent.click(screen.getByRole("checkbox", { name: "СИЗ" }));
  fireEvent.click(screen.getByRole("button", { name: "Применить" }));
  expect(apply).toHaveBeenLastCalledWith("");
  fireEvent.click(screen.getByRole("checkbox", { name: "Оборудование" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "СИЗ" }));
  expect(screen.getByRole("button", { name: "Применить" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Сбросить" }));
  expect(screen.getByRole("checkbox", { name: "СИЗ" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Оборудование" })).toBeChecked();
});
