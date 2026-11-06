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
const options = Array.from({ length: 20 }, (_, index) => ({
  value: String(index),
  label: `Место ${index}`,
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function field() {
  return (
    <SelectField
      label="Место хранения"
      searchable
      options={options}
      value=""
      onChange={vi.fn()}
    />
  );
}
function bounds(top: number, left = 20, width = 300) {
  vi.spyOn(
    screen.getByRole("combobox"),
    "getBoundingClientRect",
  ).mockReturnValue({
    top,
    bottom: top + 40,
    left,
    width,
    height: 40,
  } as DOMRect);
}
it("highlights hovered options without scrolling, but still scrolls for keyboard navigation", () => {
  render(field());
  bounds(100);
  fireEvent.focus(screen.getByRole("combobox"));
  const menu = screen.getByRole("listbox");
  const rows = screen.getAllByRole("option");
  Object.defineProperty(menu, "clientHeight", {
    configurable: true,
    value: 100,
  });
  rows.forEach((row, index) => {
    Object.defineProperty(row, "offsetTop", {
      configurable: true,
      value: index * 42,
    });
    Object.defineProperty(row, "offsetHeight", {
      configurable: true,
      value: 42,
    });
  });
  menu.scrollTop = 0;
  fireEvent.mouseMove(rows[5]);
  expect(rows[5]).toHaveClass("active");
  expect(menu.scrollTop).toBe(0);
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
  expect(rows[6]).toHaveClass("active");
  expect(menu.scrollTop).toBe(194);
});
it("waits for dialog readiness, then opens without reserving space or scrolling", () => {
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const view = render(
    <DialogPopupReadyContext.Provider value={false}>
      {field()}
    </DialogPopupReadyContext.Provider>,
  );
  bounds(window.innerHeight - 50);
  act(() => screen.getByRole("combobox").focus());
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "Место" },
  });
  expect(screen.queryByRole("listbox")).toBeNull();
  view.rerender(
    <DialogPopupReadyContext.Provider value={true}>
      {field()}
    </DialogPopupReadyContext.Provider>,
  );
  expect(screen.getByRole("listbox").parentElement).toBe(document.body);
  expect(document.querySelector("[data-select-dropdown-space]")).toBeNull();
  expect(scroll).not.toHaveBeenCalled();
});
it.each([50, window.innerHeight - 50])(
  "overlays a scrollable card without changing its content or scroll (top=%s)",
  (top) => {
    const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    render(
      <section data-testid="card" style={{ overflow: "auto", height: 300 }}>
        {field()}
        <button>Следующее поле</button>
      </section>,
    );
    const card = screen.getByTestId("card");
    card.scrollTop = 12;
    const before = card.innerHTML;
    bounds(top);
    act(() => screen.getByRole("combobox").focus());
    const menu = screen.getByRole("listbox");
    expect(menu.parentElement).toBe(document.body);
    expect(card.contains(menu)).toBe(false);
    expect(card.children).toHaveLength(3);
    expect(card.scrollTop).toBe(12);
    expect(document.querySelector("[data-select-dropdown-space]")).toBeNull();
    expect(scroll).not.toHaveBeenCalled();
    expect(before).not.toContain("select-dropdown-menu");
    if (top === 50) expect(menu.style.top).toBe("96px");
    else expect(menu.style.transformOrigin).toBe("bottom");
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(card.scrollTop).toBe(12);
  },
);
it("clamps to the visual viewport and repositions after resize without losing search", () => {
  const viewport = Object.assign(new EventTarget(), {
    offsetTop: 0,
    offsetLeft: 0,
    width: 240,
    height: 500,
  });
  vi.stubGlobal("visualViewport", viewport);
  render(field());
  bounds(400, 200, 300);
  const input = screen.getByRole("combobox");
  act(() => input.focus());
  const menu = screen.getByRole("listbox");
  expect(menu).toHaveStyle({
    width: "216px",
    left: "12px",
    transformOrigin: "bottom",
  });
  fireEvent.change(input, { target: { value: "Место 1" } });
  viewport.height = 300;
  act(() => viewport.dispatchEvent(new Event("resize")));
  expect(input).toHaveFocus();
  expect(input).toHaveValue("Место 1");
  expect(menu.style.transformOrigin).toBe("bottom");
  expect(document.querySelector("[data-select-dropdown-space]")).toBeNull();
});

it("scrolls the focused select above the keyboard before repositioning its menu", () => {
  const viewport = Object.assign(new EventTarget(), {
    offsetTop: 0,
    offsetLeft: 0,
    width: 400,
    height: 800,
  });
  vi.stubGlobal("visualViewport", viewport);
  render(field());
  const input = screen.getByRole("combobox");
  let top = 500;
  vi.spyOn(input, "getBoundingClientRect").mockImplementation(
    () =>
      ({ top, bottom: top + 40, left: 20, width: 300, height: 40 }) as DOMRect,
  );
  const scroll = vi.spyOn(window, "scrollBy").mockImplementation((options) => {
    top -= (options as ScrollToOptions).top ?? 0;
  });
  act(() => input.focus());
  viewport.height = 350;
  act(() => viewport.dispatchEvent(new Event("resize")));
  expect(scroll).toHaveBeenCalledWith({ top: 202, behavior: "instant" });
  expect(top + 40).toBeLessThan(viewport.height);
  expect(screen.getByRole("listbox").style.transformOrigin).toBe("bottom");
  expect(input).toHaveFocus();
});

it("keeps the input visible when opening with the keyboard already up and after viewport panning", () => {
  const viewport = Object.assign(new EventTarget(), {
    offsetTop: 0,
    offsetLeft: 0,
    width: 400,
    height: 350,
  });
  vi.stubGlobal("visualViewport", viewport);
  render(field());
  const input = screen.getByRole("combobox");
  let top = 500;
  vi.spyOn(input, "getBoundingClientRect").mockImplementation(
    () =>
      ({ top, bottom: top + 40, left: 20, width: 300, height: 40 }) as DOMRect,
  );
  const scroll = vi.spyOn(window, "scrollBy").mockImplementation((options) => {
    top -= (options as ScrollToOptions).top ?? 0;
  });
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
  act(() => input.focus());
  expect(top + 40).toBeLessThan(viewport.height);
  scroll.mockClear();
  top = 430;
  act(() => viewport.dispatchEvent(new Event("scroll")));
  act(() => {
    frames.splice(0).forEach((callback) => callback(0));
  });
  expect(scroll).toHaveBeenCalled();
  expect(top + 40).toBeLessThan(viewport.height);
  expect(input).toHaveFocus();
});

it("creates scroll room when the keyboard covers an input at the end of the page", () => {
  const viewport = Object.assign(new EventTarget(), {
    offsetTop: 0,
    offsetLeft: 0,
    width: 400,
    height: 350,
  });
  vi.stubGlobal("visualViewport", viewport);
  vi.spyOn(document.documentElement, "scrollHeight", "get").mockImplementation(
    () =>
      window.innerHeight +
      (parseFloat(
        document.querySelector<HTMLElement>("[data-select-keyboard-space]")
          ?.style.height ?? "0",
      ) || 0),
  );
  let scrollTop = 0;
  vi.spyOn(window, "scrollY", "get").mockImplementation(() => scrollTop);
  const view = render(field());
  const input = screen.getByRole("combobox");
  vi.spyOn(input, "getBoundingClientRect").mockImplementation(
    () =>
      ({
        top: 500 - scrollTop,
        bottom: 540 - scrollTop,
        left: 20,
        width: 300,
        height: 40,
      }) as DOMRect,
  );
  vi.spyOn(window, "scrollBy").mockImplementation((options) => {
    scrollTop = Math.min(
      scrollTop + ((options as ScrollToOptions).top ?? 0),
      document.documentElement.scrollHeight - window.innerHeight,
    );
  });
  act(() => input.focus());
  expect(document.querySelector("[data-select-keyboard-space]")).not.toBeNull();
  expect(input.getBoundingClientRect().bottom).toBeLessThan(viewport.height);
  expect(input).toHaveFocus();
  view.unmount();
  expect(document.querySelector("[data-select-keyboard-space]")).toBeNull();
});
