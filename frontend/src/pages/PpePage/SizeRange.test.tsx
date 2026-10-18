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
import { SizeRange } from "./SizeRange";
import { shoeSizeRange, gloveSizeRange, headSizeRange } from "./size-range-options";
import { defaultShoeSizes, defaultGloveSizes, defaultHeadSizes } from "../../modules/ppe-ui/ppe-size-options";

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
        <SizeRange {...shoeSizeRange} values={values} onChange={setValues} />
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

it("uses glove defaults and limits for the shared range", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  render(<ChakraProvider value={defaultSystem}><SizeRange {...gloveSizeRange} values={defaultGloveSizes()} onChange={() => {}} /></ChakraProvider>);
  expect(defaultGloveSizes()).toEqual(["7", "8", "9", "10", "11"]);
  const sliders = await screen.findAllByRole("slider");
  expect(sliders[0]).toHaveAttribute("aria-valuemin", "6");
  expect(sliders[1]).toHaveAttribute("aria-valuemax", "15");
  expect(sliders[0]).toHaveAttribute("aria-valuenow", "7");
  expect(sliders[1]).toHaveAttribute("aria-valuenow", "11");
  const input = screen.getByLabelText("Размер вручную");
  for (const value of ["5", "16", "7.5"]) {
    fireEvent.change(input, { target: { value } });
    expect(screen.getByRole("button", { name: "Добавить размер" })).toBeDisabled();
  }
});

it("uses headwear defaults and bounds", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  render(<ChakraProvider value={defaultSystem}><SizeRange {...headSizeRange} values={defaultHeadSizes()} onChange={() => {}} /></ChakraProvider>);
  expect(defaultHeadSizes()).toEqual(["55", "56", "57", "58", "59", "60", "61", "62"]);
  const sliders = await screen.findAllByRole("slider");
  expect(sliders[0]).toHaveAttribute("aria-valuemin", "54");
  expect(sliders[1]).toHaveAttribute("aria-valuemax", "65");
  expect(sliders[0]).toHaveAttribute("aria-valuenow", "55");
  expect(sliders[1]).toHaveAttribute("aria-valuenow", "62");
});
