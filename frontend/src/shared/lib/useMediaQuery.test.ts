import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useMediaQuery } from "./useMediaQuery";

afterEach(() => vi.unstubAllGlobals());

it("updates on changes and moves its subscription when the query changes", () => {
  const narrow = new EventTarget();
  const wide = new EventTarget();
  const media = {
    narrow: Object.assign(narrow, { matches: false }),
    wide: Object.assign(wide, { matches: true }),
  };
  const removeNarrow = vi.spyOn(narrow, "removeEventListener");
  const removeWide = vi.spyOn(wide, "removeEventListener");
  vi.stubGlobal("matchMedia", vi.fn((query: "narrow" | "wide") => media[query]));

  const { result, rerender, unmount } = renderHook(
    ({ query }) => useMediaQuery(query),
    { initialProps: { query: "narrow" } },
  );
  expect(result.current).toBe(false);
  act(() => {
    media.narrow.matches = true;
    narrow.dispatchEvent(new Event("change"));
  });
  expect(result.current).toBe(true);

  rerender({ query: "wide" });
  expect(removeNarrow).toHaveBeenCalledWith("change", expect.any(Function));
  act(() => {
    media.wide.matches = false;
    wide.dispatchEvent(new Event("change"));
  });
  expect(result.current).toBe(false);
  unmount();
  expect(removeWide).toHaveBeenCalledWith("change", expect.any(Function));
});

it("returns false when matchMedia is unavailable", () => {
  vi.stubGlobal("matchMedia", undefined);
  const { result } = renderHook(() => useMediaQuery("(max-width: 760px)"));
  expect(result.current).toBe(false);
});
