import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useReceiptPosition } from "./useReceiptPosition";
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.restoreAllMocks();
});
it("restores the last open line after remounting, but starts fresh in a new session", () => {
  const first = renderHook(() => useReceiptPosition("actor", "690"));
  expect(first.result.current[0]).toBeNull();
  act(() => first.result.current[1]("line-25"));
  first.unmount();
  const reopened = renderHook(() => useReceiptPosition("actor", "690"));
  expect(reopened.result.current[0]).toBe("line-25");
  reopened.unmount();
  sessionStorage.clear();
  const fresh = renderHook(() => useReceiptPosition("actor", "690"));
  expect(fresh.result.current[0]).toBeNull();
});
it("isolates position by actor and receipt", () => {
  const { result, rerender } = renderHook(
    ({ actor, receipt }) => useReceiptPosition(actor, receipt),
    { initialProps: { actor: "a", receipt: "1" } },
  );
  act(() => result.current[1]("line-5"));
  rerender({ actor: "b", receipt: "1" });
  expect(result.current[0]).toBeNull();
  rerender({ actor: "a", receipt: "2" });
  expect(result.current[0]).toBeNull();
  rerender({ actor: "a", receipt: "1" });
  expect(result.current[0]).toBe("line-5");
});
it("remains usable when storage is blocked", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("blocked");
  });
  const { result } = renderHook(() => useReceiptPosition("a", "1"));
  act(() => result.current[1]("line-3"));
  expect(result.current[0]).toBe("line-3");
});
