import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PeriodicityFields } from "./PeriodicityFields";

afterEach(cleanup);

it("associates the group and all period inputs with the error and clears the association afterwards", () => {
  const props = {
    hasPeriodicity: true,
    onHasPeriodicityChange: vi.fn(),
    onPresetApply: vi.fn(),
    onValueChange: vi.fn(),
    value: { years: "0", months: "0", weeks: "0", days: "0" },
  };
  const view = render(<PeriodicityFields {...props} error="Укажите период" />);
  const error = screen.getByText("Укажите период");
  expect(error.id).toBeTruthy();
  expect(screen.getByRole("group", { name: "Периодичность" })).toHaveAttribute("aria-describedby", error.id);
  for (const input of screen.getAllByRole("textbox")) {
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", error.id);
  }
  view.rerender(<PeriodicityFields {...props} />);
  expect(screen.getByRole("group", { name: "Периодичность" })).not.toHaveAttribute("aria-describedby");
  for (const input of screen.getAllByRole("textbox")) {
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  }
});
