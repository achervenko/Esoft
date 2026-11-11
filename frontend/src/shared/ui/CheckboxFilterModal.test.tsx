import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CheckboxFilterModal } from "./CheckboxFilterModal";
afterEach(cleanup);
it("preserves default subset semantics: empty values mean all and empty selection is invalid", () => {
  const onApply = vi.fn();
  render(
    <CheckboxFilterModal
      title="Фильтр"
      values={[]}
      options={[{ value: "a", label: "Активные" }]}
      onApply={onApply}
      onClose={() => {}}
    />,
  );
  expect(screen.getByRole("checkbox")).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Применить" }));
  expect(onApply).toHaveBeenCalledWith([]);
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByRole("button", { name: "Применить" })).toBeDisabled();
});
it("supports optional flags with an unchecked initial state, exact application and reset", () => {
  const onApply = vi.fn();
  render(
    <CheckboxFilterModal
      title="Фильтр"
      allowEmpty
      values={[]}
      options={[{ value: "deficit", label: "Только с дефицитом" }]}
      onApply={onApply}
      onClose={() => {}}
    />,
  );
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(screen.getByRole("button", { name: "Применить" })).toBeEnabled();
  fireEvent.click(screen.getByRole("checkbox"));
  expect(onApply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Применить" }));
  expect(onApply).toHaveBeenLastCalledWith(["deficit"]);
  fireEvent.click(screen.getByRole("button", { name: "Сбросить" }));
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Применить" }));
  expect(onApply).toHaveBeenLastCalledWith([]);
});
