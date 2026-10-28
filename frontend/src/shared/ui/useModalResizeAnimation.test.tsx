import { useRef } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useModalResizeAnimation } from "./useModalResizeAnimation";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("tracks CSS-driven field growth without starting a second resize on the next render", () => {
  let height = 400;
  let resized!: ResizeObserverCallback;
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        resized = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => ({ height }) as DOMRect,
  );
  const animation = { cancel: vi.fn(), onfinish: null as null | (() => void) };
  const animate = vi.fn(() => animation);
  const originalAnimate = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "animate",
  );
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: animate,
  });
  function Dialog({ revision }: { revision: number }) {
    const ref = useRef<HTMLElement>(null);
    useModalResizeAnimation(ref);
    return (
      <section ref={ref}>
        {revision}
        <small className="form-field-message" />
      </section>
    );
  }
  try {
    const view = render(<Dialog revision={0} />);
    height = 430;
    act(() => resized([], {} as ResizeObserver));
    view.rerender(<Dialog revision={1} />);
    expect(animate).not.toHaveBeenCalled();
    const message = view.container.querySelector("small")!;
    Object.defineProperty(message, "getAnimations", {
      configurable: true,
      value: () => [{ transitionProperty: "height" }],
    });
    height = 440;
    view.rerender(<Dialog revision={2} />);
    expect(animate).not.toHaveBeenCalled();
    height = 445;
    act(() => resized([], {} as ResizeObserver));
    Object.defineProperty(message, "getAnimations", { value: () => [] });
    height = 450;
    view.rerender(<Dialog revision={3} />);
    expect(animate).toHaveBeenCalledWith(
      [{ height: "445px" }, { height: "450px" }],
      expect.any(Object),
    );
    expect(view.container.firstElementChild).toHaveClass(
      "admin-modal-resizing",
    );
    act(() => animation.onfinish?.());
    expect(view.container.firstElementChild).not.toHaveClass(
      "admin-modal-resizing",
    );
    view.unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  } finally {
    if (originalAnimate)
      Object.defineProperty(HTMLElement.prototype, "animate", originalAnimate);
    else Reflect.deleteProperty(HTMLElement.prototype, "animate");
  }
});
