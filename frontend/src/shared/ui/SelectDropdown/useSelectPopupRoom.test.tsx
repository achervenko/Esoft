import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useSelectPopupRoom } from "./useSelectPopupRoom";

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function setup({
  viewport = 800,
  top = 100,
  scrollRoom = 0,
  dialog = false,
} = {}) {
  vi.stubGlobal("visualViewport", { offsetTop: 0, height: viewport });
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const scroll = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const container = document.createElement("section");
  container.style.overflowY = "auto";
  if (dialog) container.setAttribute("role", "dialog");
  Object.defineProperties(container, {
    clientHeight: { value: viewport },
    scrollHeight: { value: viewport + scrollRoom },
  });
  vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
    top: 0,
    bottom: viewport,
  } as DOMRect);
  const trigger = document.createElement("button");
  vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
    top,
    bottom: top + 40,
  } as DOMRect);
  container.append(trigger);
  document.body.append(container);
  const updateMenuPosition = vi.fn();
  const props = {
    triggerRef: { current: trigger },
    isOpen: true,
    disabled: false,
    optionCountRef: { current: 20 },
    updateMenuPosition,
  };
  const view = renderHook((p) => useSelectPopupRoom(p), {
    initialProps: props,
  });
  return { container, scroll, view, props };
}
it.each([100, 750])(
  "does not reserve space or scroll when the overlay fits below or above (top=%s)",
  (top) => {
    const { container, scroll } = setup({ top });
    expect(container.querySelector("[data-select-dropdown-space]")).toBeNull();
    expect(container.scrollTop).toBe(0);
    expect(scroll).not.toHaveBeenCalled();
  },
);
it("adds missing space only when neither side fits, and removes it on close", () => {
  const { container, view, props } = setup({ viewport: 240, top: 80 });
  const spacer = container.querySelector<HTMLElement>(
    "[data-select-dropdown-space]",
  );
  expect(spacer).not.toBeNull();
  expect(parseFloat(spacer!.style.height)).toBeGreaterThan(0);
  expect(container.scrollTop).toBeGreaterThan(0);
  view.rerender({ ...props, isOpen: false });
  expect(container.querySelector("[data-select-dropdown-space]")).toBeNull();
});
it("uses existing scroll space before adding a spacer", () => {
  const { container } = setup({ viewport: 240, top: 80, scrollRoom: 500 });
  expect(container.querySelector("[data-select-dropdown-space]")).toBeNull();
  expect(container.scrollTop).toBeGreaterThan(0);
});
it("keeps dialog overlays independent of the form layout", () => {
  const { container } = setup({ viewport: 240, top: 80, dialog: true });
  expect(container.querySelector("[data-select-dropdown-space]")).toBeNull();
  expect(container.scrollTop).toBe(0);
});
