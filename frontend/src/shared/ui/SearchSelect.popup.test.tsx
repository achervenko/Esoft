import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SearchSelect } from "./SearchSelect";
import { useSearchSelectPopup } from "./useSearchSelectPopup";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([{ isOpen: false }, { disabled: true }, { isDialogReady: false }])(
  "clears inactive popup position (%o) and recalculates on reopening",
  (inactive) => {
    const input = document.createElement("input");
    const bounds = vi.spyOn(input, "getBoundingClientRect");
    bounds.mockReturnValue({
      top: 100,
      bottom: 144,
      left: 20,
      width: 200,
    } as DOMRect);
    const props = {
      inputRef: { current: input },
      isOpen: true,
      disabled: false,
      isDialogReady: true,
      placement: "bottom" as const,
      optionCount: 1,
    };
    const { result, rerender } = renderHook(useSearchSelectPopup, {
      initialProps: props,
    });
    expect(result.current?.style.top).toBe(150);
    rerender({ ...props, ...inactive });
    expect(result.current).toBeNull();
    bounds.mockReturnValue({
      top: 200,
      bottom: 244,
      left: 20,
      width: 200,
    } as DOMRect);
    rerender(props);
    expect(result.current?.style.top).toBe(250);
  },
);

it("keeps bottom placement and limits menu height above the keyboard", () => {
  vi.stubGlobal(
    "visualViewport",
    Object.assign(new EventTarget(), { height: 400, offsetTop: 0 }),
  );
  render(
    <SearchSelect
      label="СИЗ"
      value={null}
      onChange={vi.fn()}
      placement="bottom"
      options={[{ id: 1, name: "Ботинки" }]}
    />,
  );
  const input = screen.getByRole("combobox");
  vi.spyOn(input, "getBoundingClientRect").mockReturnValue({
    top: 280,
    bottom: 324,
    left: 20,
    width: 200,
  } as DOMRect);
  fireEvent.focus(input);
  expect(screen.getByRole("listbox")).toHaveStyle({
    top: "330px",
    bottom: "auto",
    maxHeight: "62px",
  });
});

it("positions suggestions within the visible viewport above the keyboard", () => {
  vi.stubGlobal(
    "visualViewport",
    Object.assign(new EventTarget(), { height: 400, offsetTop: 30 }),
  );
  render(
    <SearchSelect
      label="СИЗ"
      value={null}
      onChange={vi.fn()}
      options={[{ id: 1, name: "Ботинки" }]}
    />,
  );
  const input = screen.getByRole("combobox");
  vi.spyOn(input, "getBoundingClientRect").mockReturnValue({
    top: 280,
    bottom: 324,
    left: 20,
    width: 200,
  } as DOMRect);
  fireEvent.focus(input);
  const menu = screen.getByRole("listbox");
  expect(menu).toHaveStyle({
    top: "auto",
    bottom: `${window.innerHeight - 280 + 6}px`,
    maxHeight: "236px",
  });
});

it("keeps the popup attached while its dialog changes height", () => {
  let resize!: () => void;
  const observe = vi.fn();
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe = observe;
      disconnect = disconnect;
    },
  );
  const view = render(
    <div data-admin-modal-id="resizing-dialog">
      <SearchSelect
        label="СИЗ"
        value={null}
        onChange={vi.fn()}
        options={[{ id: 1, name: "Обувь" }]}
      />
    </div>,
  );
  const input = screen.getByRole("combobox");
  const bounds = vi.spyOn(input, "getBoundingClientRect");
  bounds.mockReturnValue({
    top: 100,
    bottom: 144,
    left: 20,
    width: 200,
  } as DOMRect);
  fireEvent.focus(input);
  expect(screen.getByRole("listbox")).toHaveStyle({ top: "150px" });
  expect(observe).toHaveBeenCalledWith(
    input.parentElement!.closest("[data-admin-modal-id]"),
  );
  bounds.mockReturnValue({
    top: 160,
    bottom: 204,
    left: 20,
    width: 200,
  } as DOMRect);
  act(() => resize());
  expect(screen.getByRole("listbox")).toHaveStyle({ top: "210px" });
  view.unmount();
  expect(disconnect).toHaveBeenCalled();
});

it("keeps suggestions outside clipping containers and repositions on scroll", () => {
  const view = render(
    <div style={{ overflow: "hidden" }} data-admin-modal-id="norm-modal">
      <SearchSelect
        label="Item"
        options={[{ id: 1, name: "Item" }]}
        value={null}
        onChange={vi.fn()}
      />
    </div>,
  );
  const input = screen.getByRole("combobox");
  const rect = vi.spyOn(input, "getBoundingClientRect").mockReturnValue({
    left: 40,
    right: 340,
    top: window.innerHeight - 90,
    bottom: window.innerHeight - 50,
    width: 300,
    height: 40,
    x: 40,
    y: 0,
    toJSON: () => ({}),
  });
  fireEvent.focus(input);
  const menu = screen.getByRole("listbox");
  expect(menu.parentElement).toBe(document.body);
  expect(view.container.contains(menu)).toBe(false);
  expect(menu).toHaveAttribute("data-admin-modal-owner", "norm-modal");
  expect(menu).toHaveStyle({
    position: "fixed",
    bottom: "96px",
    width: "300px",
  });
  rect.mockReturnValue({
    left: 40,
    right: 340,
    top: 50,
    bottom: 90,
    width: 300,
    height: 40,
    x: 40,
    y: 50,
    toJSON: () => ({}),
  });
  fireEvent.scroll(window);
  expect(menu).toHaveStyle({ top: "96px", bottom: "auto" });
});
