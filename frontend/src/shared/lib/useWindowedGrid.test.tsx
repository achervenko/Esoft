import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useWindowedGrid } from "./useWindowedGrid";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});
it("skips unconstrained horizontal wrappers and restores distant rows on scroll or resize", () => {
  let top = 0,
    columns = "300px 300px 300px";
  const scroller = document.createElement("main");
  const horizontalWrapper = document.createElement("div");
  const grid = document.createElement("div");
  const card = document.createElement("article");
  let cardHeight = 400;
  card.dataset.gridIndex = "0";
  card.getBoundingClientRect = () => ({ height: cardHeight }) as DOMRect;
  grid.append(card);
  horizontalWrapper.append(grid);
  scroller.append(horizontalWrapper);
  document.body.append(scroller);
  Object.defineProperty(scroller, "clientHeight", { value: 800 });
  Object.defineProperty(scroller, "scrollHeight", { value: 600000 });
  Object.defineProperty(horizontalWrapper, "clientHeight", { value: 600000 });
  Object.defineProperty(horizontalWrapper, "scrollHeight", { value: 600000 });
  scroller.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
  grid.getBoundingClientRect = () => ({ top: -top, width: 936 }) as DOMRect;
  vi.spyOn(window, "getComputedStyle").mockImplementation(
    (element) =>
      ({
        overflowY:
          element === scroller || element === horizontalWrapper
            ? "auto"
            : "visible",
        gridTemplateColumns: columns,
        rowGap: "18px",
      }) as CSSStyleDeclaration,
  );
  let scheduled: FrameRequestCallback | undefined;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    scheduled = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const hook = renderHook(() => {
    const result = useWindowedGrid(4003);
    result.gridRef.current = grid;
    return result;
  });
  act(() => {
    hook.result.current.gridRef.current = grid;
    window.dispatchEvent(new Event("resize"));
  });
  act(() => scheduled?.(0));
  expect(hook.result.current.start).toBe(0);
  top = 418 * 500;
  card.dataset.gridIndex = "1500";
  cardHeight = 600;
  act(() => window.dispatchEvent(new Event("scroll")));
  act(() => scheduled?.(0));
  expect(hook.result.current.start).toBeGreaterThan(1300);
  expect(hook.result.current.before).toBe(467 * 418 - 18);
  expect(hook.result.current.end - hook.result.current.start).toBeLessThan(160);
  expect(hook.result.current.before).toBeGreaterThan(0);
  top = 0;
  columns = "390px";
  act(() => window.dispatchEvent(new Event("resize")));
  act(() => scheduled?.(0));
  expect(hook.result.current.start).toBe(0);
  expect(hook.result.current.before).toBe(0);
  expect(hook.result.current.end).toBeLessThan(60);
});
