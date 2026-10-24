import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { AdminModal } from "./AdminModal";
import "./admin-modal-test-setup";
import { SearchSelect } from "./SearchSelect";

vi.mock("./useModalResizeAnimation", () => ({
  useModalResizeAnimation: vi.fn(),
}));

it.each([false, true])(
  "finishes readiness for an offscreen search even when scrolling cannot help (form=%s)",
  (insideForm) => {
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
    const search = (
      <SearchSelect
        label="СИЗ"
        value={null}
        onChange={vi.fn()}
        options={[{ id: 1, name: "Ботинки" }]}
      />
    );
    const { unmount } = render(
      <AdminModal title="Норма" onClose={vi.fn()}>
        {insideForm ? <form>{search}</form> : search}
      </AdminModal>,
    );
    const input = screen.getByRole("combobox");
    vi.spyOn(input, "getBoundingClientRect").mockReturnValue({
      top: 600,
      bottom: 644,
      left: 20,
      width: 200,
      height: 44,
    } as DOMRect);
    act(() => input.focus());
    act(() => {
      viewport.height = 400;
      viewport.dispatchEvent(new Event("resize"));
      vi.advanceTimersByTime(120);
    });
    expect(screen.queryByRole("listbox")).toBeNull();
    act(() => vi.advanceTimersByTime(119));
    expect(screen.queryByRole("listbox")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  },
);

it.each([true, false])(
  "keeps autofocus popup content hidden until the mobile dialog is ready (options=%s)",
  (hasOptions) => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );
    vi.stubGlobal(
      "visualViewport",
      Object.assign(new EventTarget(), { height: 800, offsetTop: 0 }),
    );
    const change = vi.fn();
    render(
      <AdminModal title="Норма" onClose={vi.fn()}>
        <SearchSelect
          autoFocus
          label="Должность"
          value={null}
          onChange={change}
          options={hasOptions ? [{ id: 1, name: "Инженер" }] : []}
          emptyMessage="Нет совпадений"
        />
      </AdminModal>,
    );
    const input = screen.getByRole("combobox");
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).not.toHaveAttribute("aria-controls");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.queryByText("Нет совпадений")).toBeNull();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(change).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole("dialog")).not.toHaveAttribute(
      "data-viewport-pending",
    );
    expect(input).toHaveFocus();
    if (hasOptions) {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      expect(input).toHaveAttribute("aria-expanded", "true");
      fireEvent.click(screen.getByRole("option", { name: "Инженер" }));
      expect(change).toHaveBeenCalledWith(1);
    } else {
      expect(screen.getByRole("status")).toHaveTextContent("Нет совпадений");
    }
  },
);

it("waits for keyboard viewport changes when focusing search in an already open mobile dialog", () => {
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
    <AdminModal title="Норма" onClose={vi.fn()}>
      <SearchSelect
        label="СИЗ"
        value={null}
        onChange={vi.fn()}
        options={[{ id: 1, name: "Ботинки" }]}
      />
    </AdminModal>,
  );
  const input = screen.getByRole("combobox");
  const bounds = vi.spyOn(input, "getBoundingClientRect").mockReturnValue({
    top: 600,
    bottom: 644,
    left: 20,
    width: 200,
  } as DOMRect);
  act(() => input.focus());
  expect(input).toHaveFocus();
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(screen.getByRole("dialog")).not.toHaveAttribute(
    "data-viewport-pending",
  );
  act(() => {
    viewport.height = 500;
    viewport.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(120);
  });
  expect(screen.queryByRole("listbox")).toBeNull();
  bounds.mockReturnValue({
    top: 200,
    bottom: 244,
    left: 20,
    width: 200,
  } as DOMRect);
  const retryTouch = Object.assign(
    new Event("pointerdown", { bubbles: true }),
    { pointerType: "touch" },
  );
  act(() => input.dispatchEvent(retryTouch));
  act(() => vi.advanceTimersByTime(119));
  expect(screen.queryByRole("listbox")).toBeNull();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole("listbox")).toBeInTheDocument();
  act(() => {
    viewport.offsetTop = 20;
    viewport.dispatchEvent(new Event("scroll"));
  });
  expect(screen.queryByRole("listbox")).toBeNull();
  act(() => vi.advanceTimersByTime(120));
  expect(screen.getByRole("listbox")).toBeInTheDocument();
});
