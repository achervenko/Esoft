import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LoadingIndicator } from "./LoadingIndicator";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("does not flash for a request shorter than the reveal delay", () => {
  vi.useFakeTimers();
  const { rerender } = render(<LoadingIndicator loading />);
  act(() => vi.advanceTimersByTime(100));
  rerender(<LoadingIndicator loading={false} />);
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.queryByRole("status")).toBeNull();
});
it("keeps a shown indicator briefly and fades it before removing it", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-10T00:00:00Z"));
  const { rerender } = render(<LoadingIndicator loading />);
  act(() => vi.advanceTimersByTime(120));
  expect(screen.getByRole("status")).not.toHaveClass("leaving");
  rerender(<LoadingIndicator loading={false} />);
  act(() => vi.advanceTimersByTime(299));
  expect(screen.getByRole("status")).not.toHaveClass("leaving");
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole("status")).toHaveClass("leaving");
  act(() => vi.advanceTimersByTime(180));
  expect(screen.queryByRole("status")).toBeNull();
});
it("cancels fade-out if another request starts", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-10T00:00:00Z"));
  const { rerender } = render(<LoadingIndicator loading />);
  act(() => vi.advanceTimersByTime(420));
  rerender(<LoadingIndicator loading={false} />);
  act(() => vi.advanceTimersByTime(1));
  rerender(<LoadingIndicator loading />);
  act(() => vi.advanceTimersByTime(200));
  expect(screen.getByRole("status")).not.toHaveClass("leaving");
});
