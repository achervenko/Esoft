import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Reservation } from "../../shared/api/warehouse-reservations-api";
import {
  reservationScrollAnchor,
  useReservationWindow,
} from "./useReservationWindow";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("preserves the visible position when preceding rows shrink, grow or remain unchanged", () => {
  expect(reservationScrollAnchor([300, 100, 100], [100, 100, 100], 320)).toBe(
    120,
  );
  expect(reservationScrollAnchor([100, 100, 100], [300, 100, 100], 120)).toBe(
    320,
  );
  expect(reservationScrollAnchor([100, 100], [300, 100], 20)).toBe(20);
  expect(reservationScrollAnchor([100, 100], [100, 100], 120)).toBe(120);
});

it("windows 500 variable rows, remeasures expansion and collapses cached offscreen rows without moving the anchor", () => {
  const items = Array.from({ length: 500 }, (_, i) => ({
    id: String(i),
  })) as Reservation[];
  const scroller = document.createElement("div");
  const grid = document.createElement("div");
  const row = document.createElement("div");
  row.dataset.gridIndex = "0";
  grid.append(row);
  scroller.append(grid);
  Object.defineProperty(scroller, "clientWidth", { value: 400 });
  Object.defineProperty(scroller, "clientHeight", { value: 400 });
  let height = 296;
  row.getBoundingClientRect = () => ({ height }) as DOMRect;
  let callback: FrameRequestCallback | undefined;
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
    callback = fn;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  let resized: ResizeObserverCallback | undefined;
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(fn: ResizeObserverCallback) {
        resized = fn;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  const hook = renderHook(
    ({ expanded }) => {
      const window = useReservationWindow(items, expanded);
      window.scrollRef.current = scroller;
      window.gridRef.current = grid;
      return window;
    },
    { initialProps: { expanded: new Set(["0"]) } },
  );
  expect(hook.result.current.end).toBeLessThan(160);
  height = 396;
  act(() => resized?.([], {} as ResizeObserver));
  act(() => callback?.(0));
  expect(hook.result.current.after).toBe((500 - hook.result.current.end) * 96);
  scroller.scrollTop = 396 + 199 * 96 + 20;
  row.dataset.gridIndex = "200";
  height = 96;
  act(() => scroller.dispatchEvent(new Event("scroll")));
  act(() => callback?.(0));
  expect(hook.result.current.start).toBeGreaterThan(90);
  expect(hook.result.current.end - hook.result.current.start).toBeLessThan(160);
  const before = hook.result.current.before;
  act(() => hook.rerender({ expanded: new Set() }));
  expect(scroller.scrollTop).toBe(200 * 96 + 20);
  expect(hook.result.current.before).toBe(before - 300);
  height = 396;
  act(() => hook.rerender({ expanded: new Set(["200"]) }));
  expect(scroller.scrollTop).toBe(200 * 96 + 20);
  expect(hook.result.current.after).toBe((500 - hook.result.current.end) * 96);
  hook.unmount();
  expect(disconnect).toHaveBeenCalled();
});
