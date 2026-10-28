import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SelectField } from "../SelectField";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([300, 700])(
  "opens over a dialog without spacers or form scrolling (top=%s)",
  (top) => {
    vi.stubGlobal("innerHeight", 800);
    vi.stubGlobal("visualViewport", undefined);
    const change = vi.fn();
    const scroll = vi.spyOn(window, "scrollTo");
    render(
      <section role="dialog" aria-label="Фильтры" data-admin-modal-id="filters">
        <div style={{ overflowY: "auto" }} data-testid="form">
          <SelectField
            label="Склад"
            value="0"
            onChange={change}
            options={Array.from({ length: 20 }, (_, i) => ({
              value: String(i),
              label: `Склад ${i}`,
            }))}
          />
        </div>
      </section>,
    );
    const form = screen.getByTestId("form");
    form.scrollTop = 20;
    Object.defineProperties(form, {
      clientHeight: { value: 100 },
      scrollHeight: { value: 100 },
    });
    vi.spyOn(form, "getBoundingClientRect").mockReturnValue({
      top: top - 10,
      bottom: top + 50,
    } as DOMRect);
    const trigger = screen.getByRole("button", { name: "Склад" });
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
      top,
      bottom: top + 40,
      left: 50,
      width: 250,
      height: 40,
    } as DOMRect);
    fireEvent.click(trigger);
    const menu = screen.getByRole("listbox");
    expect(menu.parentElement).toBe(document.body);
    expect(menu).toHaveAttribute("data-admin-modal-owner", "filters");
    expect(document.querySelector("[data-select-dropdown-space]")).toBeNull();
    expect(form.scrollTop).toBe(20);
    expect(scroll).not.toHaveBeenCalled();
    if (top === 300) expect(menu.style.top).toBe("346px");
    else {
      expect(menu.style.bottom).toBe("106px");
      expect(menu.style.transformOrigin).toBe("bottom");
    }
    expect(menu.style.maxHeight).toBe("280px");
    fireEvent.click(screen.getByRole("option", { name: "Склад 2" }));
    expect(change).toHaveBeenCalledWith("2");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(form.scrollTop).toBe(20);
  },
);
