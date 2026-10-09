import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useSetupPage } from "./useSetupPage";

const api = vi.hoisted(() => ({
  createInitialAdmin: vi.fn(),
  getSetupEmployees: vi.fn(),
}));
vi.mock("../../shared/api/setup", () => api);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});

async function setup() {
  api.getSetupEmployees.mockResolvedValue({ employees: [] });
  const onCompleted = vi.fn();
  const hook = renderHook(() => useSetupPage({ onCompleted }));
  await act(async () => {});
  act(() => {
    hook.result.current.setField("employeeId", "1");
    hook.result.current.setField("email", "admin@example.test");
    hook.result.current.setField("username", "admin");
    hook.result.current.setField("password", "Secure1234");
    hook.result.current.setField("passwordConfirmation", "Secure1234");
  });
  return { ...hook, onCompleted };
}

it("keeps successful setup locked until navigation and ignores repeated submits", async () => {
  vi.useFakeTimers();
  api.createInitialAdmin.mockResolvedValue({ ok: true });
  const { result, onCompleted } = await setup();
  await act(async () => { await result.current.submit(); });
  expect(result.current.isSubmitting).toBe(true);
  expect(result.current.message).toContain("Администратор создан");
  await act(async () => { await result.current.submit(); });
  expect(api.createInitialAdmin).toHaveBeenCalledTimes(1);
  expect(result.current.error).toBeNull();
  act(() => { vi.advanceTimersByTime(899); });
  expect(onCompleted).not.toHaveBeenCalled();
  act(() => { vi.advanceTimersByTime(1); });
  expect(onCompleted).toHaveBeenCalledTimes(1);
});

it("unlocks after a failed request and allows retry", async () => {
  api.createInitialAdmin.mockRejectedValueOnce(new Error("Network error"));
  const { result } = await setup();
  await act(async () => { await result.current.submit(); });
  expect(result.current.isSubmitting).toBe(false);
  act(() => {
    result.current.setField("password", "Secure1234");
    result.current.setField("passwordConfirmation", "Secure1234");
  });
  api.createInitialAdmin.mockResolvedValue({ ok: true });
  await act(async () => { await result.current.submit(); });
  expect(api.createInitialAdmin).toHaveBeenCalledTimes(2);
  expect(result.current.isSubmitting).toBe(true);
});
