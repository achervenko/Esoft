import { fireEvent, screen, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderNormForm } from "./norm-form-test-utils";

describe("PPE norm editor: focus", () => {
  it("focuses and scrolls to each newly added PPE search without refocusing on edits", async () => {
    vi.useFakeTimers();
    const scroll = vi.spyOn(Element.prototype, "scrollTop", "set");
    const scrollIntoView = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    renderNormForm();
    expect(scroll).not.toHaveBeenCalled();
    for (const count of [2, 3]) {
      fireEvent.click(screen.getByRole("button", { name: "Добавить" }));
      const searches = screen.getAllByRole("combobox", { name: /СИЗ/ });
      expect(searches).toHaveLength(count);
      const added = searches.at(-1)!;
      expect(added).toHaveFocus();
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(added).toHaveAttribute("aria-expanded", "false");
      await act(async () => vi.advanceTimersByTime(160));
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      expect(added).toHaveFocus();
      expect(scroll.mock.instances.at(-1)).toBe(added.closest("form"));
      expect(scroll).toHaveBeenLastCalledWith(expect.any(Number));
      expect(scrollIntoView).not.toHaveBeenCalled();
      fireEvent.change(added, { target: { value: "обувь" } });
      expect(scroll).toHaveBeenCalledTimes(count - 1);
    }
  });

  it("leaves mobile add scrolling to the dialog after the keyboard settles", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(max-width: 760px)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    vi.stubGlobal(
      "visualViewport",
      Object.assign(new EventTarget(), { height: 800, offsetTop: 0 }),
    );
    renderNormForm();
    const scroll = vi.spyOn(Element.prototype, "scrollTop", "set");
    fireEvent.click(screen.getByRole("button", { name: "Добавить" }));
    expect(
      screen.getAllByRole("combobox", { name: /СИЗ/ }).at(-1),
    ).toHaveFocus();
    expect(scroll).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
