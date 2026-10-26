import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { usePpeQuery } from "./usePpeQuery";
it("hides an earlier error when disabled and retries when enabled again", async () => {
  const load = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValue("loaded");
  const hook = renderHook(
    ({ enabled }) => usePpeQuery("sizes", load, enabled),
    {
      initialProps: { enabled: true },
    },
  );
  await waitFor(() => expect(hook.result.current.error).toBeTruthy());
  hook.rerender({ enabled: false });
  expect(hook.result.current.error).toBeNull();
  expect(hook.result.current.loading).toBe(false);
  expect(load).toHaveBeenCalledTimes(1);
  hook.rerender({ enabled: true });
  await waitFor(() => expect(hook.result.current.data).toBe("loaded"));
  expect(hook.result.current.error).toBeNull();
  hook.unmount();
});
it("aborts previous requests and ignores a late response for another employee", async () => {
  let finishOld!: (value: string) => void;
  let finishNew!: (value: string) => void;
  const signals: AbortSignal[] = [];
  const load = vi.fn((signal: AbortSignal) => {
    signals.push(signal);
    return new Promise<string>((resolve) => {
      if (signals.length === 1) finishOld = resolve;
      else finishNew = resolve;
    });
  });
  const hook = renderHook(({ id }) => usePpeQuery(id, load), {
    initialProps: { id: "employee:1" },
  });
  hook.rerender({ id: "employee:2" });
  expect(signals[0].aborted).toBe(true);
  await act(async () => finishNew("new plan"));
  expect(hook.result.current.data).toBe("new plan");
  await act(async () => finishOld("old plan"));
  expect(hook.result.current.data).toBe("new plan");
  hook.unmount();
  expect(signals[1].aborted).toBe(true);
});
it("retries a failed request", async () => {
  const load = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValue("loaded");
  const hook = renderHook(() => usePpeQuery("data", load));
  await waitFor(() => expect(hook.result.current.error).toContain("сервером"));
  act(() => hook.result.current.reload());
  await waitFor(() => expect(hook.result.current.data).toBe("loaded"));
  hook.unmount();
});
