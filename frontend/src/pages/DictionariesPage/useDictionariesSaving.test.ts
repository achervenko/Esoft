import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useDictionariesSaving } from "./useDictionariesSaving";

afterEach(cleanup);

it.each([false, true])("blocks concurrent saves and unlocks after completion (failure=%s)", async (fails) => {
  const notifyError = vi.fn();
  const { result } = renderHook(() => useDictionariesSaving({
    notifyError,
    setError: vi.fn(),
    setMessage: vi.fn(),
  }));
  let finish!: () => void;
  let reject!: (error: Error) => void;
  const action = vi.fn(() => new Promise<void>((resolve, fail) => {
    finish = resolve;
    reject = fail;
  }));
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.runSavingAction(action);
    void result.current.runSavingAction(action);
  });
  expect(action).toHaveBeenCalledTimes(1);
  expect(result.current.isSaving).toBe(true);
  await act(async () => {
    if (fails) reject(new Error("Request failed"));
    else finish();
    await pending;
  });
  expect(result.current.isSaving).toBe(false);
  expect(notifyError).toHaveBeenCalledTimes(fails ? 1 : 0);
  const nextAction = vi.fn().mockResolvedValue(undefined);
  await act(() => result.current.runSavingAction(nextAction));
  expect(nextAction).toHaveBeenCalledOnce();
});
