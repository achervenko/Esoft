import { act, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { AdminModal } from "./AdminModal";
import "./admin-modal-test-setup";
import { useModalResizeAnimation } from "./useModalResizeAnimation";

vi.mock("./useModalResizeAnimation", () => ({
  useModalResizeAnimation: vi.fn(),
}));

it.each([false, true])(
  "reveals after viewport settling or a bounded fallback (keyboard resize=%s)",
  (resizes) => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );
    const viewport = Object.assign(new EventTarget(), {
      height: 800,
      offsetTop: 0,
    });
    vi.stubGlobal("visualViewport", viewport);
    render(
      <AdminModal title="Название" onClose={vi.fn()}>
        <input autoFocus aria-label="Название" />
      </AdminModal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-viewport-pending");
    expect(screen.getByRole("textbox")).toHaveFocus();
    if (resizes) {
      act(() => {
        viewport.height = 400;
        viewport.dispatchEvent(new Event("resize"));
        vi.advanceTimersByTime(60);
        viewport.dispatchEvent(new Event("resize"));
        vi.advanceTimersByTime(60);
      });
      expect(dialog).toHaveAttribute("data-viewport-pending");
      act(() => vi.advanceTimersByTime(60));
    } else {
      act(() => vi.advanceTimersByTime(500));
    }
    expect(dialog).not.toHaveAttribute("data-viewport-pending");
  },
);

it("tracks the visible viewport while the keyboard opens and removes subscriptions", () => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true })),
  );
  const viewport = Object.assign(new EventTarget(), {
    height: 800,
    offsetTop: 0,
  });
  const remove = vi.spyOn(viewport, "removeEventListener");
  vi.stubGlobal("visualViewport", viewport);
  const { unmount } = render(
    <AdminModal title="Название" onClose={vi.fn()}>
      <input autoFocus aria-label="Название" />
    </AdminModal>,
  );
  const backdrop = screen.getByRole("dialog").parentElement!;
  expect(backdrop.style.getPropertyValue("--dialog-viewport-height")).toBe(
    "800px",
  );
  act(() => {
    viewport.height = 400;
    viewport.offsetTop = 20;
    viewport.dispatchEvent(new Event("resize"));
  });
  expect(backdrop.style.getPropertyValue("--dialog-viewport-height")).toBe(
    "400px",
  );
  expect(backdrop.style.getPropertyValue("--dialog-viewport-top")).toBe("20px");
  expect(screen.getByRole("textbox")).toHaveFocus();
  unmount();
  expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
  expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
});

it.each([false, true])(
  "preserves autofocus and disables resize animation only on mobile=%s",
  (mobile) => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: mobile,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    render(
      <AdminModal title="Название" onClose={vi.fn()}>
        <input autoFocus aria-label="Название" />
      </AdminModal>,
    );
    expect(screen.getByRole("textbox", { name: "Название" })).toHaveFocus();
    expect(useModalResizeAnimation).toHaveBeenLastCalledWith(
      expect.any(Object),
      !mobile,
    );
  },
);
