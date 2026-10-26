import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SelectField } from "./SelectField";
import { DialogPopupReadyContext } from "./DialogPopupReadyContext";
const options = [
  { value: "9007199254740993", label: "Главный инженер" },
  { value: "b", label: "Кладовщик" },
  { value: "c", label: "Оператор", disabled: true },
];
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("waits for dialog readiness before reserving space and scrolling", () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
  const frames: FrameRequestCallback[] = [];
  const requestFrame = vi
    .spyOn(window, "requestAnimationFrame")
    .mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const content = (ready: boolean) => (
    <DialogPopupReadyContext.Provider value={ready}>
      <SelectField
        label="Нижнее поле"
        searchable
        options={options}
        value=""
        onChange={vi.fn()}
      />
    </DialogPopupReadyContext.Provider>
  );
  const view = render(content(false));
  const input = screen.getByRole("combobox");
  vi.spyOn(input, "getBoundingClientRect").mockReturnValue({
    top: window.innerHeight - 50,
    bottom: window.innerHeight - 10,
    left: 20,
    width: 300,
  } as DOMRect);
  act(() => input.focus());
  fireEvent.change(input, { target: { value: "инженер" } });
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(document.querySelector("[data-select-dropdown-space]")).toBeNull();
  expect(scroll).not.toHaveBeenCalled();
  expect(requestFrame).not.toHaveBeenCalled();

  view.rerender(content(true));
  expect(document.querySelector("[data-select-dropdown-space]")).not.toBeNull();
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  act(() => frames.shift()!(0));
  act(() => frames.shift()!(260));
  expect(scroll).toHaveBeenCalled();
  expect(screen.getByRole("listbox")).toBeInTheDocument();
  expect(input).toHaveFocus();
  expect(input).toHaveValue("инженер");
});
it("removes reserved space and cancels animation when unmounted", () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
  const cancel = vi.spyOn(window, "cancelAnimationFrame");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const view = render(
    <SelectField
      label="Нижнее"
      searchable
      options={options}
      value=""
      onChange={vi.fn()}
    />,
  );
  const input = screen.getByRole("combobox");
  vi.spyOn(input, "getBoundingClientRect").mockReturnValue({
    top: window.innerHeight - 50,
    bottom: window.innerHeight - 10,
    left: 20,
    width: 300,
  } as DOMRect);
  act(() => input.focus());
  act(() => frames.shift()!(0));
  act(() => frames.shift()!(260));
  expect(document.querySelector("[data-select-dropdown-space]")).not.toBeNull();
  view.unmount();
  expect(document.querySelector("[data-select-dropdown-space]")).toBeNull();
  expect(cancel).toHaveBeenCalled();
});
it("always opens down, reserves room and clamps its width to the visual viewport", () => {
  const viewport = Object.assign(new EventTarget(), {
    height: 400,
    width: 360,
    offsetTop: 30,
    offsetLeft: 0,
  });
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true })),
  );
  vi.stubGlobal("visualViewport", viewport);
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  render(
    <SelectField
      label="Должность"
      searchable
      options={options}
      value=""
      onChange={vi.fn()}
    />,
  );
  const input = screen.getByRole("combobox");
  const bounds = vi.spyOn(input, "getBoundingClientRect").mockReturnValue({
    top: 380,
    bottom: 420,
    left: -20,
    width: 500,
  } as DOMRect);
  act(() => input.focus());
  const menu = screen.getByRole("listbox");
  expect(
    input.closest(".select-dropdown-field")?.getAttribute("style"),
  ).toBeNull();
  expect(scroll).toHaveBeenCalled();
  const spacer = document.querySelector("[data-select-dropdown-space]");
  expect(spacer?.parentElement).toBe(document.body);
  expect(spacer?.previousElementSibling?.contains(input)).toBe(true);
  expect(input.closest(".select-dropdown-field")?.contains(spacer)).toBe(false);
  expect(menu).toHaveStyle({
    top: "426px",
    bottom: "auto",
    left: "12px",
    width: "336px",
  });
  fireEvent.change(input, { target: { value: "инженер" } });
  expect(menu).toHaveStyle({
    top: "426px",
    bottom: "auto",
  });
  bounds.mockReturnValue({
    top: 200,
    bottom: 240,
    left: 20,
    width: 300,
  } as DOMRect);
  viewport.height = 230;
  act(() => viewport.dispatchEvent(new Event("resize")));
  expect(input).toHaveFocus();
  expect(input).toHaveValue("инженер");
  expect(menu).toHaveStyle({
    top: "246px",
    bottom: "auto",
    maxHeight: "280px",
  });
});

it("overlays following fields without adding space when the menu fits", () => {
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  render(
    <>
      <SelectField
        label="Первое"
        searchable
        options={options}
        value=""
        onChange={vi.fn()}
      />
      <p>Следующее поле</p>
    </>,
  );
  const input = screen.getByRole("combobox");
  vi.spyOn(input, "getBoundingClientRect").mockReturnValue({
    top: 50,
    bottom: 90,
    left: 20,
    width: 300,
  } as DOMRect);
  act(() => input.focus());
  expect(screen.getByRole("listbox")).toBeInTheDocument();
  expect(document.querySelector("[data-select-dropdown-space]")).toBeNull();
  expect(
    input.closest(".select-dropdown-field")?.getAttribute("style"),
  ).toBeNull();
  expect(scroll).not.toHaveBeenCalled();
});

it("finishes the smooth scroll before mounting the dropdown", () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false })),
  );
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  render(
    <SelectField
      label="Нижнее поле"
      searchable
      options={options}
      value=""
      onChange={vi.fn()}
    />,
  );
  const input = screen.getByRole("combobox");
  vi.spyOn(input, "getBoundingClientRect").mockReturnValue({
    top: window.innerHeight - 50,
    bottom: window.innerHeight - 10,
    left: 20,
    width: 300,
  } as DOMRect);
  act(() => input.focus());
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  const spacer = document.querySelector<HTMLElement>(
    "[data-select-dropdown-space]",
  )!;
  expect(spacer.style.height).toBe("0px");
  act(() => frames.shift()!(0));
  expect(spacer.style.height).toBe("0px");
  act(() => frames.shift()!(130));
  const halfHeight = parseFloat(spacer.style.height);
  expect(halfHeight).toBeGreaterThan(0);
  expect(scroll.mock.lastCall?.[0]).toMatchObject({ top: halfHeight });
  expect(scroll).toHaveBeenCalled();
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  act(() => frames.shift()!(260));
  expect(parseFloat(spacer.style.height)).toBeCloseTo(halfHeight * 2);
  expect(screen.getByRole("listbox")).toBeInTheDocument();
  expect(input).toHaveFocus();
  const menu = screen.getByRole("listbox");
  scroll.mockClear();
  fireEvent.change(input, { target: { value: "инженер" } });
  expect(screen.getByRole("listbox")).toBe(menu);
  expect(document.querySelector("[data-select-dropdown-space]")).toBe(spacer);
  expect(parseFloat(spacer.style.height)).toBeCloseTo(halfHeight * 2);
  expect(frames).toHaveLength(0);
  expect(scroll).not.toHaveBeenCalled();
  const fullHeight = parseFloat(spacer.style.height);
  vi.spyOn(window, "scrollY", "get").mockReturnValue(fullHeight);
  fireEvent.keyDown(input, { key: "Escape" });
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(spacer.isConnected).toBe(true);
  expect(parseFloat(spacer.style.height)).toBe(fullHeight);
  act(() => frames.shift()!(300));
  act(() => frames.shift()!(430));
  expect(parseFloat(spacer.style.height)).toBeCloseTo(fullHeight / 2);
  expect(scroll.mock.lastCall?.[0]).toMatchObject({ top: fullHeight / 2 });
  act(() => frames.shift()!(560));
  expect(spacer.isConnected).toBe(false);
});
