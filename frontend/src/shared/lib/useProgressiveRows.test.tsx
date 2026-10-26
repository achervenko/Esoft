import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useProgressiveRows } from "./useProgressiveRows";
afterEach(cleanup);
it("ignores duplicate and stale load callbacks and resets for a changed dataset", () => {
  const all = Array.from({ length: 305 }, (_, id) => ({ id }));
  const hook = renderHook(
    ({ rows }) => useProgressiveRows(rows, (row) => row.id),
    { initialProps: { rows: all } },
  );
  const old = hook.result.current.loadMore;
  act(() => {
    old();
    old();
  });
  expect(hook.result.current.rows).toHaveLength(200);
  hook.rerender({ rows: all.slice(10) });
  expect(hook.result.current.rows).toHaveLength(100);
  act(old);
  expect(hook.result.current.rows).toHaveLength(100);
  act(() => hook.result.current.loadMore());
  expect(hook.result.current.rows).toHaveLength(200);
  hook.rerender({ rows: all });
  expect(hook.result.current.rows).toHaveLength(100);
  act(() => hook.result.current.loadMore());
  expect(hook.result.current.rows).toHaveLength(200);
});
