import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { AdminModal } from "./AdminModal";
import "./admin-modal-test-setup";
import { SearchSelect } from "./SearchSelect";

it.each([
  [false, false],
  [true, false],
  [false, true],
])(
  "scrolls only the form (reduced motion=%s, keyboard already open=%s)",
  (reduced, keyboardOpen) => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(max-width: 760px)" || reduced,
      })),
    );
    const viewport = Object.assign(new EventTarget(), {
      height: keyboardOpen ? 400 : 800,
      offsetTop: 0,
    });
    vi.stubGlobal("visualViewport", viewport);
    render(
      <AdminModal title="Норма" onClose={vi.fn()}>
        <form>
          <SearchSelect
            label="СИЗ"
            value={null}
            onChange={vi.fn()}
            options={[{ id: 1, name: "Ботинки" }]}
          />
        </form>
      </AdminModal>,
    );
    const input = screen.getByRole("combobox");
    const form = input.closest("form")!;
    Object.defineProperties(form, {
      clientHeight: { value: 250 },
      scrollHeight: { value: 900 },
    });
    vi.spyOn(form, "getBoundingClientRect").mockReturnValue({
      top: 100,
    } as DOMRect);
    vi.spyOn(input, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          top: 600 - form.scrollTop,
          bottom: 644 - form.scrollTop,
          height: 44,
          width: 200,
          left: 20,
        }) as DOMRect,
    );
    const scroll = vi.fn((options: ScrollToOptions) => {
      form.scrollTop = options.top!;
      fireEvent.scroll(form);
    });
    Object.defineProperty(form, "scrollTo", { value: scroll });
    const focus = vi.spyOn(input, "focus");
    const touch = Object.assign(
      new Event("pointerdown", { bubbles: true, cancelable: true }),
      { pointerType: "touch" },
    );
    act(() => input.dispatchEvent(touch));
    expect(touch.defaultPrevented).toBe(true);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(input).toHaveFocus();
    if (keyboardOpen) {
      act(() => vi.advanceTimersByTime(20));
    } else {
      expect(scroll).not.toHaveBeenCalled();
      act(() => {
        viewport.height = 400;
        viewport.dispatchEvent(new Event("resize"));
        vi.advanceTimersByTime(120);
      });
    }
    expect(scroll).toHaveBeenCalledWith({
      top: expect.any(Number),
      behavior: reduced ? "instant" : "smooth",
    });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("dialog").scrollTop).toBe(0);
    act(() => vi.advanceTimersByTime(120));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  },
);
