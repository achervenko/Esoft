import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContextMenu } from "./ContextMenu";
afterEach(cleanup);
const items = [
  { id: "one", label: "Первое", onSelect: vi.fn() },
  { id: "disabled", label: "Недоступно", disabled: true, onSelect: vi.fn() },
  { id: "last", label: "Последнее", onSelect: vi.fn() },
];
describe("ContextMenu", () => {
  it("focuses items and skips disabled actions during keyboard navigation", () => {
    render(
      <ContextMenu
        x={10}
        y={20}
        label="Действия"
        items={items}
        onClose={vi.fn()}
      />,
    );
    expect(document.activeElement).toBe(screen.getByRole("menu"));
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Первое" }),
    );
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Последнее" }),
    );
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Home" });
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Первое" }),
    );
  });
  it("closes on outside pointer, Escape and selection; calls selected action", () => {
    const close = vi.fn(),
      select = vi.fn();
    render(
      <ContextMenu
        x={10}
        y={20}
        label="Действия"
        items={[{ id: "one", label: "Первое", onSelect: select }]}
        onClose={close}
      />,
    );
    fireEvent.pointerDown(document.body);
    expect(close).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(close).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("menuitem"));
    expect(close).toHaveBeenCalledTimes(3);
    expect(select).toHaveBeenCalledOnce();
  });
  it("keeps the menu inside viewport edges", () => {
    const spy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({
        width: 200,
        height: 90,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 200,
        bottom: 90,
        toJSON() {},
      });
    render(
      <ContextMenu
        x={window.innerWidth}
        y={window.innerHeight}
        label="Действия"
        items={items}
        onClose={vi.fn()}
      />,
    );
    const menu = screen.getByRole("menu");
    expect(menu.style.left).toBe(window.innerWidth - 208 + "px");
    expect(menu.style.top).toBe(window.innerHeight - 98 + "px");
    spy.mockRestore();
  });
});
