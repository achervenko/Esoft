import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { ShoeSizeRange } from "./ShoeSizeRange";
import { defaultShoeSizes } from "./ppe-size-options";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("generates integer sizes and allows removing and manually adding sizes", async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  function Form() {
    const [values, setValues] = useState<string[]>(defaultShoeSizes);
    return (
      <ChakraProvider value={defaultSystem}>
        <ShoeSizeRange values={values} onChange={setValues} />
      </ChakraProvider>
    );
  }
  render(<Form />);
  expect(screen.getByText("Редактировать размеры (11)")).toBeInTheDocument();
  expect(defaultShoeSizes()).toEqual([
    "36",
    "37",
    "38",
    "39",
    "40",
    "41",
    "42",
    "43",
    "44",
    "45",
    "46",
  ]);
  const sliders = await screen.findAllByRole("slider");
  expect(sliders[0]).toHaveAttribute("aria-valuemin", "30");
  expect(sliders[1]).toHaveAttribute("aria-valuemax", "60");
  await act(async () => {
    sliders[1].focus();
  });
  fireEvent.keyDown(sliders[1], { key: "ArrowRight" });
  fireEvent.click(await screen.findByText("Редактировать размеры (12)"));
  fireEvent.click(screen.getByRole("button", { name: "Удалить размер 40" }));
  expect(
    screen.queryByRole("button", { name: "Удалить размер 40" }),
  ).not.toBeInTheDocument();
  const input = screen.getByLabelText("Размер вручную");
  fireEvent.change(input, { target: { value: "40.5" } });
  expect(
    screen.getByRole("button", { name: "Добавить размер" }),
  ).toBeDisabled();
  fireEvent.change(input, { target: { value: "40" } });
  fireEvent.click(screen.getByRole("button", { name: "Добавить размер" }));
  expect(
    screen.getByRole("button", { name: "Удалить размер 40" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Редактировать размеры (12)")).toBeInTheDocument();
  expect(sliders[0]).toHaveAttribute("aria-valuenow", "36");
  expect(sliders[1]).toHaveAttribute("aria-valuenow", "47");
  fireEvent.click(screen.getByRole("button", { name: "Удалить размер 47" }));
  expect(sliders[1]).toHaveAttribute("aria-valuenow", "46");
  fireEvent.click(screen.getByRole("button", { name: "Удалить размер 36" }));
  expect(sliders[0]).toHaveAttribute("aria-valuenow", "37");
  fireEvent.click(screen.getByRole("button", { name: "Удалить размер 41" }));
  expect(sliders[0]).toHaveAttribute("aria-valuenow", "37");
  expect(sliders[1]).toHaveAttribute("aria-valuenow", "46");
  fireEvent.change(input, { target: { value: "48" } });
  fireEvent.click(screen.getByRole("button", { name: "Добавить размер" }));
  expect(sliders[1]).toHaveAttribute("aria-valuenow", "48");
  fireEvent.change(input, { target: { value: "35" } });
  fireEvent.click(screen.getByRole("button", { name: "Добавить размер" }));
  expect(sliders[0]).toHaveAttribute("aria-valuenow", "35");
  expect(document.querySelector(".ppe-shoe-range-hole")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Удалить размер 42" }));
  expect(document.querySelector(".ppe-shoe-range-break")).toBeInTheDocument();
  await act(async () => {
    sliders[0].focus();
  });
  await act(async () => {
    fireEvent.keyDown(sliders[0], { key: "ArrowLeft" });
  });
  expect(
    screen.queryByRole("button", { name: "Удалить размер 41" }),
  ).not.toBeInTheDocument();
  for (let step = 0; step < 9; step++)
    await act(async () => {
      fireEvent.keyDown(sliders[0], { key: "ArrowRight" });
    });
  for (let step = 0; step < 9; step++)
    await act(async () => {
      fireEvent.keyDown(sliders[0], { key: "ArrowLeft" });
    });
  expect(
    screen.getByRole("button", { name: "Удалить размер 41" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Удалить размер 42" }),
  ).toBeInTheDocument();
});
